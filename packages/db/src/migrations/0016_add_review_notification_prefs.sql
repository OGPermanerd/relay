ALTER TABLE notification_preferences
  ADD COLUMN review_notifications_email boolean NOT NULL DEFAULT true;

ALTER TABLE notification_preferences
  ADD COLUMN review_notifications_in_app boolean NOT NULL DEFAULT true;
