'use client';

/* DEMO ONLY, DO NOT USE IN PRODUCTION */

import { CopilotPlugin } from '@platejs/ai/react';
import {
  Check,
  ChevronsUpDown,
  ExternalLinkIcon,
  Eye,
  EyeOff,
  Settings,
  Wand2Icon,
} from 'lucide-react';
import { useEditorRef } from 'platejs/react';
import * as React from 'react';

import { Button } from '@/components/platejs/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/platejs/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/platejs/ui/dialog';
import { Input } from '@/components/platejs/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/platejs/ui/popover';
import { cn } from '@/lib/utils';
import { STATIC_MODELS, type Model } from '@/lib/ai/model-list';

import { aiChatPlugin } from './plugins/ai-kit';

export const models = STATIC_MODELS;

export function SettingsDialog() {
  const editor = useEditorRef();

  const [tempModel, setTempModel] = React.useState(models[7]);
  const [tempKeys, setTempKeys] = React.useState<Record<string, string>>({
    aiGatewayApiKey: '',
    uploadthing: '',
  });
  const [showKey, setShowKey] = React.useState<Record<string, boolean>>({});
  const [open, setOpen] = React.useState(false);
  const [openModel, setOpenModel] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Update AI chat options
    const chatOptions = editor.getOptions(aiChatPlugin).chatOptions ?? {};

    editor.setOption(aiChatPlugin, 'chatOptions', {
      ...chatOptions,
      body: {
        ...chatOptions.body,
        apiKey: tempKeys.aiGatewayApiKey,
        model: tempModel.value,
      },
    });

    setOpen(false);

    // Update AI complete options
    const completeOptions =
      editor.getOptions(CopilotPlugin).completeOptions ?? {};
    editor.setOption(CopilotPlugin, 'completeOptions', {
      ...completeOptions,
      body: {
        ...completeOptions.body,
        apiKey: tempKeys.aiGatewayApiKey,
        model: tempModel.value,
      },
    });
  };

  const toggleKeyVisibility = (key: string) => {
    setShowKey((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderApiKeyInput = (service: string, label: string) => (
    <div className="group relative">
      <div className="flex items-center justify-between">
        <label
          className="absolute top-1/2 block -translate-y-1/2 cursor-text px-1 text-muted-foreground/70 text-sm transition-all group-focus-within:pointer-events-none group-focus-within:top-0 group-focus-within:cursor-default group-focus-within:font-medium group-focus-within:text-foreground group-focus-within:text-xs has-[+input:not(:placeholder-shown)]:pointer-events-none has-[+input:not(:placeholder-shown)]:top-0 has-[+input:not(:placeholder-shown)]:cursor-default has-[+input:not(:placeholder-shown)]:font-medium has-[+input:not(:placeholder-shown)]:text-foreground has-[+input:not(:placeholder-shown)]:text-xs"
          htmlFor={label}
        >
          <span className="inline-flex bg-background px-2">{label}</span>
        </label>
        <Button
          asChild
          className="absolute top-0 right-[28px] h-full"
          size="icon"
          variant="ghost"
        >
          <a
            className="flex items-center"
            href={
              service === 'aiGatewayApiKey'
                ? 'https://openrouter.ai/keys'
                : 'https://uploadthing.com/dashboard'
            }
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLinkIcon className="size-4" />
            <span className="sr-only">Get {label}</span>
          </a>
        </Button>
      </div>

      <Input
        className="pr-10"
        data-1p-ignore
        id={label}
        onChange={(e) =>
          setTempKeys((prev) => ({ ...prev, [service]: e.target.value }))
        }
        placeholder=""
        type={showKey[service] ? 'text' : 'password'}
        value={tempKeys[service]}
      />
      <Button
        className="absolute top-0 right-0 h-full"
        onClick={() => toggleKeyVisibility(service)}
        size="icon"
        type="button"
        variant="ghost"
      >
        {showKey[service] ? (
          <EyeOff className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
        <span className="sr-only">
          {showKey[service] ? 'Hide' : 'Show'} {label}
        </span>
      </Button>
    </div>
  );

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className={cn(
            'group fixed right-4 bottom-4 z-50 size-10 overflow-hidden',
            'rounded-full shadow-md hover:shadow-lg'
          )}
          size="icon"
          variant="default"
          // data-block-hide
        >
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">Settings</DialogTitle>
          <DialogDescription>
            Configure your API keys and preferences.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-10" onSubmit={handleSubmit}>
          {/* AI Settings Group */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-purple-100 p-2 dark:bg-purple-900">
                <Wand2Icon className="size-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="font-semibold">AI</h4>
            </div>

            <div className="space-y-4">
              {renderApiKeyInput('aiGatewayApiKey', 'OpenRouter API Key')}

              <div className="group relative">
                <label
                  className="absolute start-1 top-0 z-10 block -translate-y-1/2 bg-background px-2 font-medium text-foreground text-xs group-has-disabled:opacity-50"
                  htmlFor="select-model"
                >
                  Model
                </label>
                <Popover onOpenChange={setOpenModel} open={openModel}>
                  <PopoverTrigger asChild id="select-model">
                    <Button
                      aria-expanded={openModel}
                      className="w-full justify-between"
                      role="combobox"
                      size="lg"
                      variant="outline"
                    >
                      <code>{tempModel.label}</code>
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search model..." />
                      <CommandEmpty>No model found.</CommandEmpty>
                      <CommandList>
                        <CommandGroup>
                          {models.map((m) => (
                            <CommandItem
                              key={m.value}
                              onSelect={() => {
                                setTempModel(m);
                                setOpenModel(false);
                              }}
                              value={m.value}
                            >
                              <Check
                                className={cn(
                                  'mr-2 size-4',
                                  tempModel.value === m.value
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                              <code>{m.label}</code>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Upload Settings Group */}
          {/* <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-red-100 p-2 dark:bg-red-900">
                <Upload className="size-4 text-red-600 dark:text-red-400" />
              </div>
              <h4 className="font-semibold">Upload</h4>
            </div>

            <div className="space-y-4">
              {renderApiKeyInput('uploadthing', 'Uploadthing API key')}
            </div>
          </div> */}

          <Button className="w-full" size="lg" type="submit">
            Save changes
          </Button>
        </form>

        <p className="text-muted-foreground text-sm">
          Not stored anywhere. Used only for current session requests.
        </p>
      </DialogContent>
    </Dialog>
  );
}
