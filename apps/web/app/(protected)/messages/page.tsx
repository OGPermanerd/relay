import { getMyMessages } from "@/app/actions/skill-messages";
import { MessagesList } from "@/components/messages-list";

export default async function MessagesPage() {
  const messages = await getMyMessages();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="mt-1 text-sm text-gray-500">
          Grouping proposals and messages from other skill authors.
        </p>
      </div>

      <MessagesList messages={messages} />
    </div>
  );
}
