import { Section, Text, Button, Hr } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./components/email-layout";

export interface TrendingDigestEmailProps {
  recipientName: string;
  skills: Array<{ name: string; uses: number; slug: string }>;
  period: "daily" | "weekly";
  baseUrl: string;
}

export default function TrendingDigestEmail({
  recipientName,
  skills,
  period,
  baseUrl,
}: TrendingDigestEmailProps) {
  const periodLabel = period === "daily" ? "Daily" : "Weekly";

  return (
    <EmailLayout previewText={`Your ${periodLabel.toLowerCase()} trending skills digest`}>
      <Text style={headingStyle}>Your {periodLabel} Trending Skills</Text>
      <Text style={paragraphStyle}>Hi {recipientName},</Text>
      <Text style={paragraphStyle}>
        Here are the top trending skills from the past {period === "daily" ? "24 hours" : "week"}:
      </Text>
      <Hr style={hrStyle} />
      <Section style={skillListStyle}>
        {skills.map((skill, index) => (
          <Section key={skill.slug} style={skillRowStyle}>
            <Text style={skillRankStyle}>{index + 1}.</Text>
            <Text style={skillNameStyle}>{skill.name}</Text>
            <Text style={skillUsesStyle}>
              {skill.uses} {skill.uses === 1 ? "use" : "uses"}
            </Text>
          </Section>
        ))}
      </Section>
      <Hr style={hrStyle} />
      <Section style={ctaSectionStyle}>
        <Button href={`${baseUrl}/skills`} style={buttonStyle}>
          View All Skills
        </Button>
      </Section>
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

const skillListStyle: React.CSSProperties = {
  margin: "0",
  padding: "0",
};

const skillRowStyle: React.CSSProperties = {
  padding: "8px 0",
  borderBottom: "1px solid #f3f4f6",
};

const skillRankStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "bold",
  color: "#6366f1",
  margin: "0",
  display: "inline",
};

const skillNameStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#111827",
  margin: "0 0 0 4px",
  display: "inline",
};

const skillUsesStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  margin: "2px 0 0 20px",
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
