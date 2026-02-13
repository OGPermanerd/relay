import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <p className="mt-1 text-sm text-gray-600">Manage your account preferences</p>

      <div className="mt-6">
        <SettingsNav />
      </div>

      <div className="mt-8">{children}</div>
    </div>
  );
}
