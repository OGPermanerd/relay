"use client";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
}

interface TrainingExample {
  id: string;
  exampleInput: string | null;
  exampleOutput: string | null;
  expectedOutput: string | null;
  qualityScore: number | null;
  source: string;
  status: string;
  createdAt: string;
  user: { name: string | null; image: string | null } | null;
}

interface TrainingExampleListProps {
  examples: TrainingExample[];
}

export function TrainingExampleList({ examples }: TrainingExampleListProps) {
  if (examples.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No training examples yet. Add golden examples above to establish expected behavior.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Training Examples ({examples.length})</h3>
      {examples.map((example) => {
        const isGolden = example.source === "web";
        const isApproved = example.status === "approved";

        return (
          <div key={example.id} className="rounded-lg border border-gray-200 p-4 space-y-3">
            {/* Header: badges + meta */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Source badge */}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isGolden ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                }`}
              >
                {isGolden ? "Golden" : "Captured"}
              </span>
              {/* Status badge */}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isApproved ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {isApproved ? "Approved" : "Pending"}
              </span>
              {/* Quality score */}
              {example.qualityScore != null && (
                <span className="text-xs text-gray-500">Quality: {example.qualityScore}/10</span>
              )}
            </div>

            {/* Input section */}
            {example.exampleInput && (
              <div>
                <p className="text-xs font-medium uppercase text-gray-500 mb-1">Input:</p>
                <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-800 border border-gray-100">
                  <code>{example.exampleInput}</code>
                </pre>
              </div>
            )}

            {/* Output section */}
            {(example.exampleOutput || example.expectedOutput) && (
              <div>
                <p className="text-xs font-medium uppercase text-gray-500 mb-1">Expected Output:</p>
                <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-800 border border-gray-100">
                  <code>{example.exampleOutput || example.expectedOutput}</code>
                </pre>
              </div>
            )}

            {/* Footer: user + date */}
            <div className="text-xs text-gray-400">
              {example.user?.name && <span>Submitted by {example.user.name} &middot; </span>}
              {formatDate(example.createdAt)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
