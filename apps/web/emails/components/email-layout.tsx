import { Html, Head, Body, Container, Section, Text, Link, Preview } from "@react-email/components";
import * as React from "react";

interface EmailLayoutProps {
  children: React.ReactNode;
  previewText?: string;
}

export default function EmailLayout({ children, previewText }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      {previewText && <Preview>{previewText}</Preview>}
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={cardStyle}>{children}</Section>
          <Section style={footerSectionStyle}>
            <Text style={footerTextStyle}>
              &copy; {new Date().getFullYear()} EverySkill. All rights reserved.
            </Text>
            <Text style={footerTextStyle}>
              <Link href="https://everyskill.ai/settings/notifications" style={footerLinkStyle}>
                Manage notification preferences
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: 0,
  padding: 0,
};

const containerStyle: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "40px 20px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  padding: "32px",
  border: "1px solid #e5e7eb",
};

const footerSectionStyle: React.CSSProperties = {
  textAlign: "center" as const,
  padding: "20px 0",
};

const footerTextStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  lineHeight: "16px",
  margin: "4px 0",
};

const footerLinkStyle: React.CSSProperties = {
  color: "#6b7280",
  textDecoration: "underline",
};
