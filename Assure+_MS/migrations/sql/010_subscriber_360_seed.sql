-- =====================================================================================
--  010_subscriber_360_seed.sql  ·  Subscriber 360 sample data
--
--  9 enterprise companies with branches, departments and BANs, plus retail
--  consumers — 65 subscriber lines in total, spread across the DPD and risk
--  bands so every downstream module has natural candidates (see the notes at
--  the foot of this file).
--
--  Deterministic: values derive from the row index, never from random(), so
--  re-running produces the same dataset. Every insert is ON CONFLICT DO
--  NOTHING against its natural key, so the script is safe to re-run.
-- =====================================================================================

BEGIN;

-- ---- 1. Companies ------------------------------------------------------------------
INSERT INTO customer_schema.company (company_code, name, industry, country_code, hq_city) VALUES
 ('COMP-001','ABC Technologies','Information Technology','AE','Dubai'),
 ('COMP-002','Meridian Logistics','Transport & Logistics','AE','Abu Dhabi'),
 ('COMP-003','Falcon Financial Services','Banking & Finance','AE','Dubai'),
 ('COMP-004','Sunrise Healthcare Group','Healthcare','AE','Sharjah'),
 ('COMP-005','Nimbus Retail Holdings','Retail','AE','Dubai'),
 ('COMP-006','Orion Construction','Construction','AE','Abu Dhabi'),
 ('COMP-007','BlueWave Media','Media & Entertainment','AE','Dubai'),
 ('COMP-008','Vertex Manufacturing','Manufacturing','AE','Ajman'),
 ('COMP-009','Cedar Education Trust','Education','AE','Al Ain')
ON CONFLICT (company_code) DO NOTHING;

-- ---- 2. Branches -------------------------------------------------------------------
-- Multi-branch companies first; the last two run from a single office.
INSERT INTO customer_schema.company_branch (company_id, branch_code, name, city, region_code, is_head_office)
SELECT c.id,
       'BR-' || lpad((row_number() OVER (ORDER BY c.id, b.ord))::text, 4, '0'),
       b.name, b.city, b.region, b.ord = 1
  FROM customer_schema.company c
  JOIN LATERAL (VALUES
        (1,'Head Office Branch','Dubai','North'),
        (2,'Regional Branch','Abu Dhabi','West'),
        (3,'Support Branch','Sharjah','East')
       ) AS b(ord, name, city, region)
    ON b.ord <= CASE c.company_code
                  WHEN 'COMP-001' THEN 3 WHEN 'COMP-002' THEN 3 WHEN 'COMP-003' THEN 2
                  WHEN 'COMP-004' THEN 2 WHEN 'COMP-005' THEN 3 WHEN 'COMP-006' THEN 2
                  WHEN 'COMP-007' THEN 1 WHEN 'COMP-008' THEN 2 ELSE 1 END
ON CONFLICT (branch_code) DO NOTHING;

-- ---- 3. Departments (only where the company bills per cost centre) -----------------
INSERT INTO customer_schema.department (branch_id, name, cost_centre)
SELECT b.id, d.name, 'CC-' || lpad(b.id::text, 3, '0') || '-' || d.ord
  FROM customer_schema.company_branch b
  JOIN customer_schema.company c ON c.id = b.company_id
  JOIN LATERAL (VALUES (1,'Operations'), (2,'Sales'), (3,'Field Services')) AS d(ord, name)
    ON d.ord <= CASE WHEN c.company_code IN ('COMP-001','COMP-003','COMP-005') THEN 3 ELSE 0 END
ON CONFLICT (branch_id, name) DO NOTHING;

-- ---- 4. Billing accounts (BANs) ----------------------------------------------------
-- Larger companies split billing across several BANs; smaller ones use one.
INSERT INTO customer_schema.billing_account
       (ban, company_id, name, billing_cycle, payment_terms_days, currency_code, credit_limit)
SELECT 'BAN' || (10000 + row_number() OVER (ORDER BY c.id, k.ord))::text,
       c.id,
       c.name || ' — ' || k.label,
       ((c.id * 3) % 28) + 1,
       CASE WHEN k.ord = 1 THEN 30 ELSE 45 END,
       'AED',
       250000 * k.ord
  FROM customer_schema.company c
  JOIN LATERAL (VALUES
        (1,'Corporate Voice'), (2,'Data & Connectivity'), (3,'Field Operations')
       ) AS k(ord, label)
    ON k.ord <= CASE c.company_code
                  WHEN 'COMP-001' THEN 3 WHEN 'COMP-002' THEN 2 WHEN 'COMP-003' THEN 2
                  WHEN 'COMP-005' THEN 2 WHEN 'COMP-008' THEN 2 ELSE 1 END
ON CONFLICT (ban) DO NOTHING;

-- ---- 5. Enterprise subscribers (employees) -----------------------------------------
-- 35 employees spread across every branch, round-robin so each branch is populated.
CREATE TEMP TABLE emp(seq INT, full_name TEXT) ON COMMIT DROP;
INSERT INTO emp(seq, full_name) VALUES
 (1,'Aarav Menon'),(2,'Zoya Rahman'),(3,'Karthik Iyer'),(4,'Fatima Al Suwaidi'),
 (5,'Daniel Okoye'),(6,'Neha Kapoor'),(7,'Omar Haddad'),(8,'Priya Nair'),
 (9,'Yusuf Khan'),(10,'Elena Petrova'),(11,'Rohan Desai'),(12,'Layla Mansour'),
 (13,'Vikram Shetty'),(14,'Hana Suzuki'),(15,'Ahmed Zayed'),(16,'Grace Mwangi'),
 (17,'Sanjay Pillai'),(18,'Mariam Abdulla'),(19,'Thomas Weber'),(20,'Ananya Rao'),
 (21,'Bilal Farooq'),(22,'Chloe Dubois'),(23,'Rahul Verma'),(24,'Amina Bakr'),
 (25,'Peter Nowak'),(26,'Divya Krishnan'),(27,'Hassan Ali'),(28,'Sofia Marino'),
 (29,'Naveen Gupta'),(30,'Reem Al Blooshi'),(31,'Ethan Clarke'),(32,'Meera Joshi'),
 (33,'Tariq Saleh'),(34,'Isabella Rossi'),(35,'Arjun Malhotra');

WITH branches AS (
    SELECT b.id AS branch_id, b.company_id, b.region_code,
           row_number() OVER (ORDER BY b.id) AS bidx,
           count(*) OVER () AS bcount
      FROM customer_schema.company_branch b
)
INSERT INTO customer_schema.customer
       (customer_code, customer_type, full_name, email, phone, msisdn,
        segment_code, region_code, country_code, city, company_id,
        credit_score, risk_score, risk_level, contactability,
        best_contact_time, best_channel_code, status, onboarded_on)
SELECT 'CUST-ENT-' || lpad(e.seq::text, 3, '0'),
       'ENTERPRISE',
       e.full_name,
       lower(replace(e.full_name, ' ', '.')) || '@corp.example.ae',
       '+971 5' || (2 + e.seq % 6)::text || ' ' || lpad(((e.seq * 731) % 1000)::text, 3, '0')
                || ' ' || lpad(((e.seq * 197) % 10000)::text, 4, '0'),
       '+9715' || lpad(((e.seq * 4211) % 100000000)::text, 8, '0'),
       'Enterprise', br.region_code, 'AE',
       CASE e.seq % 4 WHEN 0 THEN 'Dubai' WHEN 1 THEN 'Abu Dhabi' WHEN 2 THEN 'Sharjah' ELSE 'Ajman' END,
       br.company_id,
       520 + (e.seq * 13) % 340,
       round(((e.seq * 17) % 100)::numeric, 2),
       CASE WHEN (e.seq * 17) % 100 >= 80 THEN 'Critical'
            WHEN (e.seq * 17) % 100 >= 60 THEN 'High'
            WHEN (e.seq * 17) % 100 >= 30 THEN 'Medium' ELSE 'Low' END,
       round((45 + (e.seq * 7) % 50)::numeric, 2),
       CASE e.seq % 3 WHEN 0 THEN '9 AM-12 PM' WHEN 1 THEN '1 PM-4 PM' ELSE '5 PM-8 PM' END,
       CASE e.seq % 4 WHEN 0 THEN 'Email' WHEN 1 THEN 'WhatsApp' WHEN 2 THEN 'SMS' ELSE 'Dialer' END,
       'ACTIVE',
       DATE '2023-01-10' + (e.seq * 9)
  FROM emp e
  JOIN branches br ON br.bidx = ((e.seq - 1) % br.bcount) + 1
ON CONFLICT (customer_code) DO NOTHING;

-- ---- 6. Consumer subscribers -------------------------------------------------------
CREATE TEMP TABLE cons(seq INT, full_name TEXT) ON COMMIT DROP;
INSERT INTO cons(seq, full_name) VALUES
 (1,'Ravi Sharma'),(2,'Aisha Khalid'),(3,'John Mathew'),(4,'Sara Ibrahim'),
 (5,'Manoj Pillai'),(6,'Huda Al Marri'),(7,'Steven Wright'),(8,'Kavya Menon'),
 (9,'Imran Sheikh'),(10,'Lucia Fernandes'),(11,'Deepak Rana'),(12,'Noor Ahmed'),
 (13,'Michael Brown'),(14,'Shreya Bose'),(15,'Abdul Rahman'),(16,'Emily Carter'),
 (17,'Nikhil Jain'),(18,'Salma Yousef'),(19,'George Miller'),(20,'Pooja Reddy'),
 (21,'Waleed Nasser'),(22,'Hannah Schmidt'),(23,'Suresh Babu'),(24,'Dana Ali'),
 (25,'Robert Fox'),(26,'Ishita Sen'),(27,'Kareem Fathi'),(28,'Olivia Bennett'),
 (29,'Prakash Kumar'),(30,'Zainab Hussain');

INSERT INTO customer_schema.customer
       (customer_code, customer_type, full_name, email, phone, msisdn,
        segment_code, region_code, country_code, city,
        credit_score, risk_score, risk_level, contactability,
        best_contact_time, best_channel_code, status, onboarded_on)
SELECT 'CUST-CON-' || lpad((100 + c.seq)::text, 3, '0'),
       'CONSUMER',
       c.full_name,
       lower(replace(c.full_name, ' ', '.')) || '@example.ae',
       '+971 5' || (0 + c.seq % 9)::text || ' ' || lpad(((c.seq * 613) % 1000)::text, 3, '0')
                || ' ' || lpad(((c.seq * 271) % 10000)::text, 4, '0'),
       '+9715' || lpad(((c.seq * 3319) % 100000000)::text, 8, '0'),
       'Consumer',
       CASE c.seq % 4 WHEN 0 THEN 'North' WHEN 1 THEN 'South' WHEN 2 THEN 'East' ELSE 'West' END,
       'AE',
       CASE c.seq % 4 WHEN 0 THEN 'Dubai' WHEN 1 THEN 'Abu Dhabi' WHEN 2 THEN 'Sharjah' ELSE 'Al Ain' END,
       480 + (c.seq * 11) % 380,
       round(((c.seq * 23) % 100)::numeric, 2),
       CASE WHEN (c.seq * 23) % 100 >= 80 THEN 'Critical'
            WHEN (c.seq * 23) % 100 >= 60 THEN 'High'
            WHEN (c.seq * 23) % 100 >= 30 THEN 'Medium' ELSE 'Low' END,
       round((40 + (c.seq * 11) % 55)::numeric, 2),
       CASE c.seq % 3 WHEN 0 THEN '9 AM-12 PM' WHEN 1 THEN '1 PM-4 PM' ELSE '5 PM-8 PM' END,
       CASE c.seq % 5 WHEN 0 THEN 'SMS' WHEN 1 THEN 'WhatsApp' WHEN 2 THEN 'IVR'
                      WHEN 3 THEN 'Email' ELSE 'Dialer' END,
       'ACTIVE',
       DATE '2022-06-01' + (c.seq * 11)
  FROM cons c
ON CONFLICT (customer_code) DO NOTHING;

-- Consumers own their BAN directly.
INSERT INTO customer_schema.billing_account
       (ban, customer_id, name, billing_cycle, payment_terms_days, currency_code, credit_limit)
SELECT 'BAN' || (20000 + row_number() OVER (ORDER BY cu.id))::text,
       cu.id, cu.full_name || ' — Personal', ((cu.id * 5) % 28) + 1, 15, 'AED', 5000
  FROM customer_schema.customer cu
 WHERE cu.customer_code LIKE 'CUST-CON-1%'
ON CONFLICT (ban) DO NOTHING;

COMMIT;
