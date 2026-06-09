import React, { useState } from "react";
import {
  useListAllReviews,
  useModerateReview,
  useDeleteReview,
  getListAllReviewsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Trash2, Star, Check, X, MessageSquare, ChevronDown,
  ChevronUp, Clock, CheckCircle2, XCircle, BarChart3,
  Image as ImageIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Tab = "all" | "pending" | "approved";

function StarRow({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(sz, i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200 fill-gray-200")}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review, onModerate, onDelete }: {
  review: any;
  onModerate: (id: number, payload: { isApproved?: boolean; adminReply?: string | null }) => void;
  onDelete: (id: number) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState(review.adminReply ?? "");
  const [imgOpen, setImgOpen] = useState(false);

  const hasImages = review.images && review.images.length > 0;

  return (
    <div className={cn(
      "bg-white rounded-xl border shadow-sm overflow-hidden transition-all",
      !review.isApproved && "border-l-4 border-l-amber-400"
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex items-start gap-3 min-w-0">
          {/* Avatar placeholder */}
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {(review.userName ?? "C").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm">{review.userName ?? `User #${review.userId}`}</span>
              <span className="text-gray-400 text-xs">•</span>
              <span className="text-gray-500 text-xs">
                {new Date(review.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </div>
            <div className="text-xs text-blue-600 font-medium mt-0.5 truncate max-w-xs">
              {review.productName ?? `Product #${review.productId}`}
            </div>
            <div className="mt-1.5">
              <StarRow rating={review.rating} size="sm" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant={review.isApproved ? "default" : "secondary"}
            className={cn(
              "text-xs",
              review.isApproved
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-amber-100 text-amber-700 border-amber-200"
            )}
          >
            {review.isApproved ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" />Approved</>
            ) : (
              <><Clock className="h-3 w-3 mr-1" />Pending</>
            )}
          </Badge>
        </div>
      </div>

      {/* Comment */}
      {review.comment && (
        <div className="px-5 pb-3">
          <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
        </div>
      )}

      {/* Images */}
      {hasImages && (
        <div className="px-5 pb-3">
          <button
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            onClick={() => setImgOpen(!imgOpen)}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            {review.images.length} photo{review.images.length > 1 ? "s" : ""}
            {imgOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {imgOpen && (
            <div className="flex flex-wrap gap-2 mt-2">
              {review.images.map((img: string, i: number) => (
                <a key={i} href={img} target="_blank" rel="noreferrer">
                  <img
                    src={img}
                    alt={`Review photo ${i + 1}`}
                    className="h-20 w-20 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Existing admin reply display */}
      {review.adminReply && !replyOpen && (
        <div className="mx-5 mb-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 mb-1">
            <MessageSquare className="h-3.5 w-3.5" />
            Store Reply
          </div>
          <p className="text-sm text-blue-800 leading-relaxed">{review.adminReply}</p>
        </div>
      )}

      {/* Reply composer */}
      {replyOpen && (
        <div className="mx-5 mb-3 space-y-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a public reply to this review…"
            className="text-sm resize-none"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setReplyText(review.adminReply ?? "");
                setReplyOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!replyText.trim()}
              onClick={() => {
                onModerate(review.id, { adminReply: replyText.trim() || null });
                setReplyOpen(false);
              }}
            >
              Save Reply
            </Button>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between gap-2 px-5 py-3 bg-gray-50 border-t">
        <div className="flex items-center gap-1.5">
          {!review.isApproved ? (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white h-8 px-3 text-xs"
              onClick={() => onModerate(review.id, { isApproved: true })}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Approve
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-amber-700 border-amber-300 hover:bg-amber-50 h-8 px-3 text-xs"
              onClick={() => onModerate(review.id, { isApproved: false })}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Unapprove
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-8 px-3 text-xs",
              replyOpen ? "bg-blue-50 border-blue-300 text-blue-700" : "text-gray-600"
            )}
            onClick={() => setReplyOpen(!replyOpen)}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            {review.adminReply ? "Edit Reply" : "Reply"}
          </Button>
          {review.adminReply && !replyOpen && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-gray-400 hover:text-red-500"
              onClick={() => onModerate(review.id, { adminReply: null })}
            >
              Remove reply
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
          onClick={() => onDelete(review.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function Reviews() {
  const [tab, setTab] = useState<Tab>("pending");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const approvedParam = tab === "pending" ? false : tab === "approved" ? true : undefined;
  const { data: rawData, isLoading } = useListAllReviews(
    approvedParam !== undefined ? { approved: approvedParam } : undefined
  );
  const { data: allData } = useListAllReviews();
  const moderateReview = useModerateReview();
  const deleteReview = useDeleteReview();

  const reviews: any[] = Array.isArray(rawData) ? rawData : (rawData as any)?.reviews ?? [];
  const allReviews: any[] = Array.isArray(allData) ? allData : (allData as any)?.reviews ?? [];

  const pendingCount = allReviews.filter((r) => !r.isApproved).length;
  const approvedCount = allReviews.filter((r) => r.isApproved).length;
  const avgRating = allReviews.length
    ? (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1)
    : "—";

  const handleModerate = (id: number, payload: { isApproved?: boolean; adminReply?: string | null }) => {
    moderateReview.mutate({ id, data: payload as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAllReviewsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAllReviewsQueryKey({ approved: true }) });
        queryClient.invalidateQueries({ queryKey: getListAllReviewsQueryKey({ approved: false }) });
        const action = payload.isApproved === true ? "approved" : payload.isApproved === false ? "unapproved" : "updated";
        toast({ title: `Review ${action}` });
      },
      onError: () => toast({ title: "Failed to update review", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Permanently delete this review?")) return;
    deleteReview.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAllReviewsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAllReviewsQueryKey({ approved: true }) });
        queryClient.invalidateQueries({ queryKey: getListAllReviewsQueryKey({ approved: false }) });
        toast({ title: "Review deleted" });
      },
      onError: () => toast({ title: "Failed to delete review", variant: "destructive" }),
    });
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "pending", label: "Pending", count: pendingCount },
    { key: "approved", label: "Approved", count: approvedCount },
    { key: "all", label: "All", count: allReviews.length },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Reviews</h2>
        <p className="text-gray-500 text-sm mt-1">Moderate customer reviews, approve or reject, and reply publicly.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Reviews", value: allReviews.length, icon: BarChart3, color: "text-blue-600 bg-blue-50" },
          { label: "Pending Approval", value: pendingCount, icon: Clock, color: "text-amber-600 bg-amber-50" },
          { label: "Approved", value: approvedCount, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
          { label: "Avg Rating", value: avgRating, icon: Star, color: "text-yellow-600 bg-yellow-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
            <div className={cn("p-2 rounded-lg", color)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              tab === key
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full font-semibold",
                tab === key
                  ? key === "pending" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                  : "bg-gray-200 text-gray-600"
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Review list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <div className="text-center space-y-2">
            <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm">Loading reviews…</p>
          </div>
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white rounded-xl border">
          <Star className="h-10 w-10 mb-3 text-gray-200" />
          <p className="font-medium text-gray-500">No {tab !== "all" ? tab : ""} reviews</p>
          <p className="text-sm mt-1">
            {tab === "pending" ? "All reviews have been moderated." : "No reviews in this category yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r: any) => (
            <ReviewCard
              key={r.id}
              review={r}
              onModerate={handleModerate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
