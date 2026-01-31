import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;
  const firstName = user.name?.split(" ")[0] || "there";

  const navigationCards = [
    {
      title: "Your Profile",
      description: "View your profile, avatar, and contribution statistics",
      href: "/profile",
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
          />
        </svg>
      ),
    },
    {
      title: "Share a Skill",
      description: "Upload your prompts, workflows, and agent configurations",
      href: "/skills/new",
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      ),
    },
    {
      title: "Browse Skills",
      description: "Discover skills shared by your colleagues",
      href: "/skills",
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {firstName}!</h1>
        <p className="mt-2 text-gray-600">
          Connect with colleagues who have the skills you need, and share your own expertise.
        </p>
      </div>

      {/* Navigation Cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        {navigationCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-50 p-3 text-blue-600 group-hover:bg-blue-100">
                {card.icon}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
                <p className="text-sm text-gray-600">{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Stats Placeholder */}
      <div className="mt-8 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Your Impact</h2>
        <p className="mt-1 text-sm text-gray-600">
          Start sharing skills to see your contribution metrics here.
        </p>
        <div className="mt-4 flex gap-8">
          <div>
            <p className="text-2xl font-bold text-blue-600">0</p>
            <p className="text-xs text-gray-500">Skills shared</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">0</p>
            <p className="text-xs text-gray-500">FTE days saved</p>
          </div>
        </div>
      </div>
    </div>
  );
}
