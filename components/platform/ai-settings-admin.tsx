"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronsUpDown, Eye, EyeOff, Loader2, Save, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  fetchOpenRouterModels,
  getPlatformAiConfig,
  updatePlatformAiConfig,
  type PlatformAiConfigData,
} from "@/lib/actions/platform-ai-config";
import { STATIC_MODELS, type Model } from "@/lib/ai/model-list";
import { cn } from "@/lib/utils";

const FEATURE_LABELS: Record<string, string> = {
  model_main_chat: "Main AI Chat",
  model_copilot: "Copilot (ghost text)",
  model_command: "Editor Commands (Cmd+J)",
  model_plate: "Document Editor AI",
  model_konva: "Report / Presentation AI",
  model_sheet: "Spreadsheet AI",
  model_selection: "Selection AI",
  model_analyze_layout: "Layout Analysis",
  model_content_gen: "Content Generation",
};

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as Array<
  keyof typeof FEATURE_LABELS
>;

const USE_DEFAULT = "__default__";

function ModelCombobox({
  models,
  value,
  onValueChange,
  placeholder = "Select a model",
  showDefault = false,
}: {
  models: Model[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  showDefault?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel =
    value === USE_DEFAULT
      ? "Use default model"
      : models.find((m) => m.value === value)?.label ?? value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {value ? selectedLabel : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList className="max-h-64">
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              {showDefault && (
                <CommandItem
                  value="__default__use-default-model"
                  onSelect={() => {
                    onValueChange(USE_DEFAULT);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === USE_DEFAULT ? "opacity-100" : "opacity-0",
                    )}
                  />
                  Use default model
                </CommandItem>
              )}
              {models.map((m) => (
                <CommandItem
                  key={m.value}
                  value={`${m.value} ${m.label}`}
                  onSelect={() => {
                    onValueChange(m.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === m.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {m.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AiSettingsAdmin() {
  const [config, setConfig] = useState<PlatformAiConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<Model[]>(STATIC_MODELS);
  const [overridesOpen, setOverridesOpen] = useState(false);

  // Form state
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("google/gemini-2.5-flash");
  const [featureModels, setFeatureModels] = useState<Record<string, string>>(
    {},
  );

  // Fetch compatible models via server action (uses real API key from DB)
  const loadModels = useCallback(async () => {
    try {
      const { models: fetched } = await fetchOpenRouterModels();
      if (fetched.length > 0) setModels(fetched);
    } catch {
      // Keep static fallback
    }
  }, []);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    const { config: c, error } = await getPlatformAiConfig();
    if (error || !c) {
      toast.error(error ?? "Failed to load AI config");
      setLoading(false);
      return;
    }
    setConfig(c);
    setApiKey(c.openrouter_api_key ?? "");
    setDefaultModel(c.default_model);
    const fm: Record<string, string> = {};
    for (const key of FEATURE_KEYS) {
      fm[key] = (c[key as keyof PlatformAiConfigData] as string | null) ?? USE_DEFAULT;
    }
    setFeatureModels(fm);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();
    loadModels();
  }, [loadConfig, loadModels]);

  const handleTestConnection = async () => {
    const keyToTest = apiKey && !apiKey.startsWith("sk-or-......") ? apiKey : null;
    if (!keyToTest) {
      toast.error("Enter a valid OpenRouter API key first");
      return;
    }
    try {
      // Test the key the user typed (may not be saved yet)
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${keyToTest}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        toast.success("Connection successful! Save settings and refresh to load models.");
      } else {
        toast.error(`Connection failed: ${res.status} ${res.statusText}`);
      }
    } catch {
      toast.error("Connection failed — check your API key");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const updates: Partial<PlatformAiConfigData> = {
      default_model: defaultModel,
    };

    // Only send API key if changed (not masked)
    if (apiKey && !apiKey.startsWith("sk-or-......")) {
      updates.openrouter_api_key = apiKey;
    }

    // Feature model overrides
    for (const key of FEATURE_KEYS) {
      const val = featureModels[key];
      (updates as Record<string, string | null>)[key] =
        val === USE_DEFAULT ? null : val;
    }

    const { success, error } = await updatePlatformAiConfig(updates);
    if (success) {
      toast.success("AI settings saved");
      await loadConfig();
      // Refresh model list with the (possibly new) API key
      await loadModels();
    } else {
      toast.error(error ?? "Failed to save");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the AI provider and models used across the platform.
          All AI features use{" "}
          <a
            href="https://openrouter.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            OpenRouter
          </a>{" "}
          to access 200+ LLM models.
        </p>
      </div>

      {/* API Key */}
      <section className="space-y-3 rounded-lg border p-4">
        <Label htmlFor="api-key" className="text-base font-medium">
          OpenRouter API Key
        </Label>
        <p className="text-xs text-muted-foreground">
          Get your key at{" "}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            openrouter.ai/keys
          </a>
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            className="shrink-0"
          >
            <Zap className="mr-1 h-4 w-4" />
            Test
          </Button>
        </div>
      </section>

      {/* Default Model */}
      <section className="space-y-3 rounded-lg border p-4">
        <Label className="text-base font-medium">Default Model</Label>
        <p className="text-xs text-muted-foreground">
          Used for all AI features unless overridden below. Only models
          supporting vision + tool calling are shown.
        </p>
        <ModelCombobox
          models={models}
          value={defaultModel}
          onValueChange={setDefaultModel}
        />
      </section>

      {/* Per-Feature Overrides */}
      <Collapsible open={overridesOpen} onOpenChange={setOverridesOpen}>
        <section className="rounded-lg border p-4">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <span className="text-base font-medium">
                  Per-Feature Model Overrides
                </span>
                <p className="text-xs text-muted-foreground">
                  Optionally use different models for specific features.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {overridesOpen ? "Hide" : "Show"}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            {FEATURE_KEYS.map((key) => (
              <div key={key} className="space-y-1">
                <Label className="text-sm">{FEATURE_LABELS[key]}</Label>
                <ModelCombobox
                  models={models}
                  value={featureModels[key] || USE_DEFAULT}
                  onValueChange={(v) =>
                    setFeatureModels((prev) => ({ ...prev, [key]: v }))
                  }
                  showDefault
                />
              </div>
            ))}
          </CollapsibleContent>
        </section>
      </Collapsible>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
