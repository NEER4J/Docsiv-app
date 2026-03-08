export default function SettingsProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="font-ui text-xl font-semibold">Profile Settings</h1>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="font-body mb-1 block text-[0.75rem] text-muted-foreground">
            Name
          </label>
          <input
            type="text"
            defaultValue="Neeraj"
            className="font-body w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem]"
          />
        </div>
        <div>
          <label className="font-body mb-1 block text-[0.75rem] text-muted-foreground">
            Email
          </label>
          <input
            type="email"
            defaultValue="n@agency.com"
            className="font-body w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem]"
          />
        </div>
        <div>
          <label className="font-body mb-1 block text-[0.75rem] text-muted-foreground">
            Password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            className="font-body w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem]"
          />
        </div>
      </div>
    </div>
  );
}
