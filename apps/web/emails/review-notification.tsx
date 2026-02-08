import { Section, Text, Button, Link, Hr } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/email-layout";

export interface ReviewNotificationEmailProps {
  recipientName: string;
  type:
    | "review_submitted"
    | "review_approved"
    | "review_rejected"
    | "review_changes_requested"
    | "review_published";
  skillName: string;
  notes?: string;
  reviewerName?: string;
  actionUrl: string;
}

const HEADINGS: Record<string, string> = {
  review_submitted: "Skill Submitted for Review",
  review_approved: "Skill Approved",
  review_rejected: "Skill Rejected",
  review_changes_requested: "Changes Requested",
  review_published: "Skill Published",
};

const CTA_LABELS: Record<string, string> = {
  review_submitted: "Review Now",
  review_approved: "View Skill",
  review_rejected: "Edit Skill",
  review_changes_requested: "Edit Skill",
  review_published: "View Skill",
};

function getPreviewText(type: string, skillName: string): string {
  switch (type) {
    case "review_submitted":
      return `${skillName} submitted for review`;
    case "review_approved":
      return `${skillName} has been approved`;
    case "review_rejected":
      return `${skillName} has been rejected`;
    case "review_changes_requested":
      return `Changes requested for ${skillName}`;
    case "review_published":
      return `${skillName} is now published`;
    default:
      return `Update on ${skillName}`;
  }
}

function getBodyText(type: string, skillName: string, reviewerName?: string): React.ReactNode {
  const byReviewer = reviewerName ? (
    <>
      {" "}
      by <strong>{reviewerName}</strong>
    </>
  ) : null;

  switch (type) {
    case "review_submitted":
      return (
        <>
          <strong>{skillName}</strong> has been submitted for review{byReviewer}.
        </>
      );
    case "review_approved":
      return (
        <>
          Your skill <strong>{skillName}</strong> has been approved{byReviewer}.
        </>
      );
    case "review_rejected":
      return (
        <>
          Your skill <strong>{skillName}</strong> has been rejected{byReviewer}.
        </>
      );
    case "review_changes_requested":
      return (
        <>
          Changes have been requested for your skill <strong>{skillName}</strong>
          {byReviewer}.
        </>
      );
    case "review_published":
      return (
        <>
          Your skill <strong>{skillName}</strong> is now published and available to everyone.
        </>
      );
    default:
      return (
        <>
          There is an update on <strong>{skillName}</strong>.
        </>
      );
  }
}

export default function ReviewNotificationEmail({
  recipientName,
  type,
  skillName,
  notes,
  reviewerName,
  actionUrl,
}: ReviewNotificationEmailProps) {
  const heading = HEADINGS[type] || "Review Update";
  const ctaLabel = CTA_LABELS[type] || "View";
  const showNotes =
    notes &&
    (type === "review_rejected" ||
      type === "review_changes_requested" ||
      type === "review_approved");

  return (
    <EmailLayout previewText={getPreviewText(type, skillName)}>
      <Text style={headingStyle}>{heading}</Text>
      <Text style={paragraphStyle}>Hi {recipientName},</Text>
      <Text style={paragraphStyle}>{getBodyText(type, skillName, reviewerName)}</Text>
      {showNotes && (
        <>
          <Hr style={hrStyle} />
          <Section style={quoteBlockStyle}>
            <Text style={quoteTextStyle}>{notes}</Text>
          </Section>
        </>
      )}
      <Hr style={hrStyle} />
      <Section style={ctaSectionStyle}>
        <Button href={actionUrl} style={buttonStyle}>
          {ctaLabel}
        </Button>
      </Section>
      <Text style={footerNoteStyle}>
        You can also view this by visiting:{" "}
        <Link href={actionUrl} style={linkStyle}>
          {actionUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}

const headingStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#111827",
  margin: "0 0 16px 0",
};

const paragraphStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#374151",
  margin: "0 0 12px 0",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "20px 0",
};

const quoteBlockStyle: React.CSSProperties = {
  backgroundColor: "#f3f4f6",
  borderLeft: "4px solid #6366f1",
  borderRadius: "4px",
  padding: "12px 16px",
  margin: "0",
};

const quoteTextStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#4b5563",
  fontStyle: "italic",
  margin: "0",
};

const ctaSectionStyle: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#6366f1",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600",
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  display: "inline-block",
};

const footerNoteStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  margin: "0",
};

const linkStyle: React.CSSProperties = {
  color: "#6366f1",
  textDecoration: "underline",
};
