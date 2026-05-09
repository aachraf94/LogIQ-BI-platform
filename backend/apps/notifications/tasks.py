"""
Celery tasks for alert evaluation and notification dispatch.

TODO:
- evaluate_alert_rules(): run periodically (every 15 min) to check KPI thresholds
- send_email_alert(alert_id): send email notification for a triggered alert
- send_sms_alert(alert_id): send SMS via Algerian SMS gateway
- dispatch_in_app_notification(alert_id, user_id): push to WebSocket channel
"""
