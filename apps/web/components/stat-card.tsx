interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, suffix, icon }: StatCardProps) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        {icon && <div className="text-blue-600">{icon}</div>}
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {value}
            {suffix && <span className="ml-1 text-sm font-normal text-gray-400">{suffix}</span>}
          </p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
