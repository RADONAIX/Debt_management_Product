-- Handover brief for a chatbot conversation picked up by a human agent.
--
-- 061 gave chatbot.escalations the queue state the engagement centre needs.
-- This adds the one thing an agent still lacked on opening a conversation: a
-- brief. Until now they got the raw transcript and `detail`, which holds only
-- the bot's closing sentence.
--
-- The negotiation bot writes this column when it steps back — facts first
-- (balances, the trigger and the verbatim message that fired it, the terms on
-- the table), then a model-written narrative a moment later. The bot tolerates
-- the column being absent, so this migration can land before or after the bot
-- ships; it simply starts being populated once both are in place.
--
-- Shape, for the console:
--   { session_id, generated_at, trigger, trigger_message, escalated_at_turn,
--     escalation_status, customer_name, account_code, outstanding, disputed,
--     negotiable_balance, days_overdue, turns, strategies_used[],
--     agreement{disc_ratio,pmt_ratio,pmt_days,inst_prds}, agreement_value,
--     agreement_in_money{...}, narrative{...}|null, narrative_error|null }
--
-- `narrative` is null when the summarising model call failed; `narrative_error`
-- then carries the reason. Render the facts regardless — they are always there.

ALTER TABLE chatbot.escalations
    ADD COLUMN IF NOT EXISTS summary jsonb;

COMMENT ON COLUMN chatbot.escalations.summary IS
    'Handover brief written by the negotiation bot at escalation: account '
    'facts, the trigger and triggering message, terms on the table, and a '
    'model-written narrative. Null until the bot writes it.';

-- The queue lists waiting conversations and shows each one''s headline, so the
-- brief is read on the inbox path, not only on the detail path.
CREATE INDEX IF NOT EXISTS idx_chatbot_escalation_summarised
    ON chatbot.escalations(status)
    WHERE summary IS NOT NULL;

-- 061 grants unconditionally, which aborts on a database where the service
-- role was never created — a local build restored straight from the dump runs
-- everything as its owner. Guard it so this migration is safe on both.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'assure') THEN
        GRANT SELECT, INSERT, UPDATE ON chatbot.escalations TO assure;
    END IF;
END $$;
