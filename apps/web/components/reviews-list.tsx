import Image from "next/image";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  hoursSavedEstimate: number | null;
  createdAt: Date;
  user: {
    name: string | null;
    image: string | null;
  };
}

interface ReviewsListProps {
  reviews: Review[];
}

export function ReviewsList({ reviews }: ReviewsListProps) {
  if (reviews.length === 0) {
    return <p className="text-gray-500">No reviews yet. Be the first to review!</p>;
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-lg border border-gray-200 p-4">
          {/* Header with user info and rating */}
          <div className="flex items-center gap-3">
            {/* User avatar */}
            {review.user.image ? (
              <Image
                src={review.user.image}
                alt={review.user.name || "User"}
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                {review.user.name?.charAt(0).toUpperCase() || "?"}
              </div>
            )}

            {/* User info */}
            <div>
              <p className="font-medium">{review.user.name || "Anonymous"}</p>
              <div className="flex items-center gap-2">
                {/* Star rating - stored as 1-5 */}
                <span className="text-yellow-500">
                  {"★".repeat(Math.min(review.rating, 5))}
                  {"☆".repeat(5 - Math.min(review.rating, 5))}
                </span>
                {/* Date */}
                <span className="text-sm text-gray-500">
                  {review.createdAt.toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Comment */}
          {review.comment && <p className="mt-2 text-gray-700">{review.comment}</p>}

          {/* Hours saved estimate */}
          {review.hoursSavedEstimate && (
            <p className="mt-1 text-sm text-gray-500">
              Estimated {review.hoursSavedEstimate} hours saved
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
