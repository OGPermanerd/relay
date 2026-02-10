import { signOut } from "@/auth";

interface SignOutButtonProps {
  theme?: "light" | "dark";
}

export function SignOutButton({ theme = "light" }: SignOutButtonProps) {
  const dark = theme === "dark";

  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className={`rounded-md px-3 py-2 text-sm font-medium transition ${
          dark
            ? "text-[#7a9ab4] hover:bg-[#1a3050] hover:text-[#dbe9f6]"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        Sign out
      </button>
    </form>
  );
}
