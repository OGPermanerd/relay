import { Section, Text, Button, Link, Hr } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/email-layout";

export interface GroupingProposalEmailProps {
  recipientName: string;
  proposerName: string;
  skillName: string;
  parentSkillName: string;
  message: string;
  actionUrl: string;
}

export default function GroupingProposalEmail({
  recipientName,
  proposerName,
  skillName,
  parentSkillName,
  message,
  actionUrl,
}: GroupingProposalEmailProps) {
  return (
    <EmailLayout
      previewText={`${proposerName} wants to group "${skillName}" under "${parentSkillName}"`}
    >
      <Text style={headingStyle}>Skill Grouping Request</Text>
      <Text style={paragraphStyle}>Hi {recipientName},</Text>
      <Text style={paragraphStyle}>
        <strong>{proposerName}</strong> has proposed grouping <strong>{skillName}</strong> under{" "}
        <strong>{parentSkillName}</strong>.
      </Text>
      <Hr style={hrStyle} />
      <Section style={quoteBlockStyle}>
        <Text style={quoteTextStyle}>{message}</Text>
      </Section>
      <Hr style={hrStyle} />
      <Section style={ctaSectionStyle}>
        <Button href={actionUrl} style={buttonStyle}>
          View Request
        </Button>
      </Section>
      <Text style={footerNoteStyle}>
        You can also view this request by visiting:{" "}
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
