"use client";

type TimeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  stepMinutes?: number;
};

function buildTimeOptions(stepMinutes: number, value: string) {
  const options: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    options.push(`${hh}:${mm}`);
  }
  if (value && !options.includes(value)) {
    options.push(value);
    options.sort();
  }
  return options;
}

export default function TimeSelect({
  value,
  onChange,
  className = "",
  required = false,
  stepMinutes = 30,
}: TimeSelectProps) {
  const options = buildTimeOptions(stepMinutes, value);

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`appearance-none ${className}`}
        required={required}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
