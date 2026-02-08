import { Section, Text, Button, Hr } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/email-layout";

export interface PlatformUpdateEmailProps {
  recipientName: string;
  title: string;
  description: string;
  version?: string;
  actionUrl?: string;
}

export default function PlatformUpdateEmail({
  recipientName,
  title,
  description,
  version,
  actionUrl,
}: PlatformUpdateEmailProps) {
  return (
    <EmailLayout previewText={title}>
      <Text style={headingStyle}>{title}</Text>
      <Text style={paragraphStyle}>Hi {recipientName},</Text>
      {version && (
        <Section style={versionBadgeSectionStyle}>
          <Text style={versionBadgeStyle}>v{version}</Text>
        </Section>
      )}
      <Text style={paragraphStyle}>{description}</Text>
      {actionUrl && (
        <>
          <Hr style={hrStyle} />
          <Section style={ctaSectionStyle}>
            <Button href={actionUrl} style={buttonStyle}>
              Learn More
            </Button>
          </Section>
        </>
      )}
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

const versionBadgeSectionStyle: React.CSSProperties = {
  margin: "0 0 16px 0",
};

const versionBadgeStyle: React.CSSProperties = {
  backgroundColor: "#eef2ff",
  color: "#4338ca",
  fontSize: "12px",
  fontWeight: "600",
  padding: "4px 10px",
  borderRadius: "12px",
  display: "inline-block",
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
