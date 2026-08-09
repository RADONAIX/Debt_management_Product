--
-- PostgreSQL database dump
--

\restrict UcRzCquTUCwI4INMs4aTbjZFaIrTlBnVXu5guPpqwWO4aEmJdXE9z9lMclFk2vC

-- Dumped from database version 16.13 (Homebrew)
-- Dumped by pg_dump version 16.13 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: assure
--

CREATE TABLE public.audit_logs (
    id character varying(36) NOT NULL,
    actor character varying(128) NOT NULL,
    actor_id character varying(36),
    action character varying(255) NOT NULL,
    target character varying(255),
    ip_address inet,
    user_agent character varying(512),
    request_id character varying(64),
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    at timestamp with time zone NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO assure;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: assure
--

CREATE TABLE public.roles (
    id character varying(64) NOT NULL,
    name character varying(128) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    status character varying(32) DEFAULT 'Active'::character varying NOT NULL,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO assure;

--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: assure
--

CREATE TABLE public.user_sessions (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    refresh_jti character varying(64) NOT NULL,
    user_agent character varying(512),
    ip_address inet,
    issued_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    last_seen_at timestamp with time zone
);


ALTER TABLE public.user_sessions OWNER TO assure;

--
-- Name: users; Type: TABLE; Schema: public; Owner: assure
--

CREATE TABLE public.users (
    id character varying(36) NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(64),
    department character varying(128),
    hashed_password character varying(255) NOT NULL,
    role_id character varying(64) NOT NULL,
    status character varying(32) DEFAULT 'Active'::character varying NOT NULL,
    avatar character varying(16),
    last_login timestamp with time zone,
    deleted_at timestamp with time zone,
    failed_login_count integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    must_reset_password boolean DEFAULT false NOT NULL,
    password_changed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO assure;

--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: assure
--

COPY public.audit_logs (id, actor, actor_id, action, target, ip_address, user_agent, request_id, meta, at) FROM stdin;
8d2e226a-7547-42f8-b1a8-5bf709322b58	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	48d79ae4544c49b18dc76e5642ced4ff	{}	2026-08-04 18:48:41.894521+05:30
e9296d54-9ec2-4158-bdef-4a1b4ea10298	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	curl/8.7.1	2e958841d2c445b4a41a4e653aa0b56c	{}	2026-08-04 18:49:11.708842+05:30
6ba98388-6d73-4fae-b7d7-e81fc4748830	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	curl/8.7.1	92172652a9a94776a3e72f86d3c41951	{}	2026-08-04 18:49:39.850561+05:30
2bfc8876-1f23-41c0-806c-4f1feb81362e	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	709724381d394a1da23cb72fbf2545a2	{}	2026-08-04 19:02:43.562027+05:30
f86e9832-b5c7-43df-a01f-cc7a9f2a7136	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	curl/8.7.1	c3a11983b3424a0bbf805aab7aaf7fa1	{}	2026-08-04 19:04:19.689842+05:30
207784b3-9b9c-4dc9-8fdb-2630cf102e48	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Deleted user	969a475b-af91-4598-ba1b-3790275014e5	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	6fd51f811ac64491b8844c031920114b	{}	2026-08-04 19:10:55.282226+05:30
c4218869-35c4-408f-a5e2-e9aa61355ccb	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	curl/8.7.1	0c8520c97103448a9b7585b8a1ba9357	{}	2026-08-04 19:10:55.525081+05:30
e790edf7-143a-4d67-abed-b80a63d780ea	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Deleted user	10d6ece2-d25c-4bd2-ad77-09d8831c6184	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	a1327a0ed16049c1b2fe8880b6ff5d02	{}	2026-08-04 19:10:57.476969+05:30
806920fd-daa2-4691-83a4-7b5698a91080	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Deleted user	1c66b011-d3e9-49f5-9c82-6811d61219cf	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	939e050b6b4b4763bec075254c0155bd	{}	2026-08-04 19:10:59.692399+05:30
ce1c30d6-606c-41f4-9b96-f6822b1f22b6	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Deleted user	941a3fb9-c3bc-4312-a5e2-0545cfcafe68	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2dfdd4bfd60942be902fa51a5d537dbd	{}	2026-08-04 19:11:01.366244+05:30
4b698661-58db-48fe-a014-a9400a804ee6	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Saved role	qa_reviewer	192.168.65.1	curl/8.7.1	4d67fde879254c0c96fba446804e9d3e	{}	2026-08-04 19:11:12.675034+05:30
54d562d0-e5b9-48a3-8363-429219cd0fdc	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Updated role	qa_reviewer	192.168.65.1	curl/8.7.1	b76ecd41c8324fd586dee92811cf3472	{}	2026-08-04 19:11:12.68932+05:30
f5bc54f9-4d40-4fc7-95f7-ffb6ce79fd34	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Updated role permissions	qa_reviewer	192.168.65.1	curl/8.7.1	513ee97aa48c4cec8429e1b8ff9847c5	{}	2026-08-04 19:11:12.703389+05:30
891ab381-05b0-428d-923b-c059130347ec	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	curl/8.7.1	759e3282e0c84f7f8c9b971f291c359e	{}	2026-08-04 19:11:30.662143+05:30
f70d8d0a-2427-4ac9-87bd-2a86510dd6ad	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Created user	ba7f437c-69ec-4eb0-917f-020c0390394a	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	1f305ddad7e44bf1bb017e8c5e2ff042	{}	2026-08-04 19:11:51.200304+05:30
ef8a6b03-377b-4634-bdb3-b3bf1dad7e61	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Created user	27f8f754-e990-4d8a-97c7-e54267eb6882	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	ea5c74ed38a24a36bc0c47ec40e24f53	{}	2026-08-04 19:12:57.090817+05:30
922bd5a7-cbae-49a9-87ad-e1cfaac9cdfe	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	curl/8.7.1	a5137cb2026340158780a38a7571e9fc	{}	2026-08-04 19:13:00.980919+05:30
f9848a75-d21b-4cca-b5b7-50ae78d8a6ce	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Deleted role	qa_reviewer	192.168.65.1	curl/8.7.1	1c1254c181ac4a2fb5104bad7d0d7742	{}	2026-08-04 19:13:21.830551+05:30
5fbc5f5e-9ee5-4e69-9852-193bae80dd68	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	curl/8.7.1	62e05b03e0e84fc788ae642873d79369	{}	2026-08-04 19:13:54.945461+05:30
0abc6d90-fb15-4cbd-a289-110f1ddd9a6f	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Saved role	ml_engineer	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	4c763ee092f14d41a9aa586256d312ab	{}	2026-08-04 19:16:33.13551+05:30
d796ad74-f6d3-4978-bb61-60c7c7033beb	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Updated role permissions	ml_engineer	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	082a8d2bd388446382738afb43b97ba7	{}	2026-08-04 19:16:59.711783+05:30
c659b2a8-7147-4710-8183-0a69e65958a7	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Updated role permissions	ml_engineer	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	21fcf3cb0b3b4e64858c9564ae100377	{}	2026-08-04 19:17:03.026381+05:30
ea93c501-b108-4420-8049-72e20ae7a5f2	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Updated user	27f8f754-e990-4d8a-97c7-e54267eb6882	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	a9acab1cfc99453a82194a8454a098a7	{}	2026-08-04 19:17:12.512338+05:30
870d0be9-542f-4b0a-881d-0114d3813968	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed out	\N	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	a6dcb5e3f8954c26bef342c55d82a0e5	{}	2026-08-04 19:17:15.663296+05:30
7d994d3e-171e-40fe-a77d-3e8a6577e14e	manoj@platum-ai.co.in	27f8f754-e990-4d8a-97c7-e54267eb6882	Signed in	27f8f754-e990-4d8a-97c7-e54267eb6882	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	017744f7841844c088088947f24ce0b2	{}	2026-08-04 19:17:28.265922+05:30
a54f5952-cc6d-4943-8fef-03553d2676f1	manoj@platum-ai.co.in	27f8f754-e990-4d8a-97c7-e54267eb6882	Signed out	\N	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	6ca0d09aef2b4848b57a64fe973010ce	{}	2026-08-04 19:17:48.799095+05:30
64795754-8b6f-4df6-b855-7b4bbc9d646b	abhishekn@platum-ai.co.in	ba7f437c-69ec-4eb0-917f-020c0390394a	Signed in	ba7f437c-69ec-4eb0-917f-020c0390394a	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	8376ffb4c8ab493587e9f1157d023e19	{}	2026-08-04 19:18:18.411826+05:30
1131d1f5-2a78-4801-86d7-4f4f5680361e	abhishekn@platum-ai.co.in	ba7f437c-69ec-4eb0-917f-020c0390394a	Signed out	\N	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	0b3283f336d54cf891d19dc1b0da1352	{}	2026-08-04 19:18:33.417368+05:30
c65f518e-91b5-4a1b-9c85-0d3e9f6da772	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	d8553940cb914fd984187b316acad2ef	{}	2026-08-04 19:17:54.865642+05:30
c86ce237-c55d-42b7-9281-e3e3f297dc49	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed out	\N	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	ebc5ffdf4ea046faa97613cfa8715141	{}	2026-08-04 19:18:06.892816+05:30
5c01bb0f-434e-47f8-aef4-716201e99763	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	372c3dc8842d42ada02e501f8f4560ab	{}	2026-08-04 19:18:37.110185+05:30
e8f092cb-8a2c-4e64-8f45-c06841e1f165	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	curl/8.7.1	405d00026cc44988a7d63f424262ef1d	{}	2026-08-04 19:24:47.154664+05:30
85ea7027-4f31-4a07-bbf7-a84fc3427d60	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	curl/8.7.1	43f5cecc306a42308fc6a80f62fdd5a0	{}	2026-08-04 19:25:02.032575+05:30
6a92ada6-13c5-4149-81a0-a4151f199886	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	192.168.65.1	curl/8.7.1	6ef9142c33234b5e9d0110b2175906f3	{}	2026-08-04 19:25:33.60529+05:30
54539baf-53c9-4757-9a50-d6ce364dabc3	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	127.0.0.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	33014d4c62ee40d49de7e64957d544d1	{}	2026-08-04 19:32:27.723758+05:30
a59e63c0-7a22-4afb-8155-e1a99383e0c9	admin@radonaix.io	f794726d-934d-4696-b063-33a2e845fbd2	Signed in	f794726d-934d-4696-b063-33a2e845fbd2	127.0.0.1	curl/8.7.1	d79ee73db7774de8bc7b10e880a30840	{}	2026-08-04 19:33:13.578641+05:30
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: assure
--

COPY public.roles (id, name, description, status, permissions, is_system, created_at, updated_at) FROM stdin;
admin	Administrator	Full platform access including user and role management.	Active	{"customer360": {"edit": true, "view": true}, "aiGuardrails": {"edit": true, "view": true}, "riskanalysis": {"edit": true, "view": true}, "chatbotConfig": {"edit": true, "view": true}, "selfServiceBI": {"edit": true, "view": true}, "agentdashboard": {"edit": true, "view": true}, "caseManagement": {"edit": true, "view": true}, "roleManagement": {"edit": true, "view": true}, "userManagement": {"edit": true, "view": true}, "agentPerformance": {"edit": true, "view": true}, "riskGridAnalytics": {"edit": true, "view": true}, "aiEngagementCenter": {"edit": true, "view": true}, "performancereports": {"edit": true, "view": true}, "portfoliodashboard": {"edit": true, "view": true}, "dunningStrategySummary": {"edit": true, "view": true}, "dunningStrategyDesigner": {"edit": true, "view": true}}	t	2026-08-04 18:48:22.338139+05:30	2026-08-04 19:10:25.530719+05:30
analyst	Analyst	Read access to dashboards, reports, risk and cases.	Active	{"customer360": {"edit": false, "view": true}, "aiGuardrails": {"edit": false, "view": false}, "riskanalysis": {"edit": false, "view": true}, "chatbotConfig": {"edit": false, "view": false}, "selfServiceBI": {"edit": false, "view": false}, "agentdashboard": {"edit": false, "view": false}, "caseManagement": {"edit": true, "view": true}, "roleManagement": {"edit": false, "view": false}, "userManagement": {"edit": false, "view": false}, "agentPerformance": {"edit": true, "view": true}, "riskGridAnalytics": {"edit": false, "view": true}, "aiEngagementCenter": {"edit": false, "view": false}, "performancereports": {"edit": false, "view": true}, "portfoliodashboard": {"edit": false, "view": true}, "dunningStrategySummary": {"edit": false, "view": false}, "dunningStrategyDesigner": {"edit": false, "view": false}}	t	2026-08-04 18:48:22.338139+05:30	2026-08-04 19:10:25.530719+05:30
supervisor	Supervisor	Manages operations, strategy and customer modules.	Active	{"customer360": {"edit": true, "view": true}, "aiGuardrails": {"edit": true, "view": true}, "riskanalysis": {"edit": true, "view": true}, "chatbotConfig": {"edit": true, "view": true}, "selfServiceBI": {"edit": true, "view": true}, "agentdashboard": {"edit": true, "view": true}, "caseManagement": {"edit": true, "view": true}, "roleManagement": {"edit": false, "view": false}, "userManagement": {"edit": false, "view": false}, "agentPerformance": {"edit": true, "view": true}, "riskGridAnalytics": {"edit": true, "view": true}, "aiEngagementCenter": {"edit": true, "view": true}, "performancereports": {"edit": true, "view": true}, "portfoliodashboard": {"edit": true, "view": true}, "dunningStrategySummary": {"edit": true, "view": true}, "dunningStrategyDesigner": {"edit": true, "view": true}}	t	2026-08-04 18:48:22.338139+05:30	2026-08-04 19:10:25.530719+05:30
ml_engineer	ML Engineer	ML analyst - Analyzing the ML data 	Active	{"customer360": {"edit": false, "view": false}, "aiGuardrails": {"edit": true, "view": true}, "riskanalysis": {"edit": false, "view": false}, "chatbotConfig": {"edit": true, "view": true}, "selfServiceBI": {"edit": false, "view": false}, "agentdashboard": {"edit": false, "view": false}, "caseManagement": {"edit": false, "view": false}, "roleManagement": {"edit": false, "view": false}, "userManagement": {"edit": false, "view": false}, "agentPerformance": {"edit": false, "view": false}, "riskGridAnalytics": {"edit": false, "view": false}, "aiEngagementCenter": {"edit": true, "view": true}, "performancereports": {"edit": false, "view": false}, "portfoliodashboard": {"edit": false, "view": false}, "dunningStrategySummary": {"edit": false, "view": false}, "dunningStrategyDesigner": {"edit": false, "view": false}}	f	2026-08-04 19:16:33.128765+05:30	2026-08-04 19:17:03.023233+05:30
viewer	Viewer	Read-only access to dashboards and reports.	Active	{"customer360": {"edit": false, "view": false}, "aiGuardrails": {"edit": false, "view": false}, "riskanalysis": {"edit": false, "view": false}, "chatbotConfig": {"edit": false, "view": false}, "selfServiceBI": {"edit": false, "view": false}, "agentdashboard": {"edit": false, "view": false}, "caseManagement": {"edit": false, "view": false}, "roleManagement": {"edit": false, "view": false}, "userManagement": {"edit": false, "view": false}, "agentPerformance": {"edit": false, "view": false}, "riskGridAnalytics": {"edit": false, "view": false}, "aiEngagementCenter": {"edit": false, "view": false}, "performancereports": {"edit": false, "view": true}, "portfoliodashboard": {"edit": false, "view": true}, "dunningStrategySummary": {"edit": false, "view": false}, "dunningStrategyDesigner": {"edit": false, "view": false}}	t	2026-08-04 18:48:22.338139+05:30	2026-08-04 19:10:25.530719+05:30
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: assure
--

COPY public.user_sessions (id, user_id, refresh_jti, user_agent, ip_address, issued_at, expires_at, revoked_at, last_seen_at) FROM stdin;
71e76b14-34f4-4ffb-8c2f-a140198d8602	f794726d-934d-4696-b063-33a2e845fbd2	ecd3b33a69314e64817c91efe378f7c4	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	192.168.65.1	2026-08-04 18:48:41.891509+05:30	2026-08-18 18:48:41.891509+05:30	\N	2026-08-04 18:48:41.891509+05:30
d48461b9-f311-44b7-b3fc-073c1bccf5a9	f794726d-934d-4696-b063-33a2e845fbd2	6bed3de8462e4d63b02c68c0b7964af0	curl/8.7.1	192.168.65.1	2026-08-04 18:49:11.7069+05:30	2026-08-18 18:49:11.7069+05:30	\N	2026-08-04 18:49:11.7069+05:30
d50492a1-e36b-474b-81aa-bae657fb9d87	f794726d-934d-4696-b063-33a2e845fbd2	8e846d442d364719b1e52c53c4a7d49f	curl/8.7.1	192.168.65.1	2026-08-04 18:49:39.843963+05:30	2026-08-18 18:49:39.843963+05:30	\N	2026-08-04 18:49:39.843963+05:30
8ef78dfb-7b6f-4365-851c-48711bc21db6	f794726d-934d-4696-b063-33a2e845fbd2	a170dba6047c4b33a99d253874adeac6	curl/8.7.1	192.168.65.1	2026-08-04 19:04:19.687582+05:30	2026-08-18 19:04:19.687582+05:30	\N	2026-08-04 19:04:19.687582+05:30
af3a7a10-8d38-46b1-a784-0758912e3144	f794726d-934d-4696-b063-33a2e845fbd2	0ebd2dbd22224b0c9f55c1a3aac1fd63	curl/8.7.1	192.168.65.1	2026-08-04 19:10:55.523112+05:30	2026-08-18 19:10:55.523112+05:30	\N	2026-08-04 19:10:55.523112+05:30
b8732ac6-d862-4526-ac2e-b6c66640253a	f794726d-934d-4696-b063-33a2e845fbd2	a00cd7464d2048b9ae6ee3655a5e32ec	curl/8.7.1	192.168.65.1	2026-08-04 19:11:30.661219+05:30	2026-08-18 19:11:30.672718+05:30	\N	2026-08-04 19:11:30.672718+05:30
e3f3a8a0-9763-4cb9-afbc-e5eb98de0a0d	f794726d-934d-4696-b063-33a2e845fbd2	4f20aa0c66934277a886e6ab23e1b74f	curl/8.7.1	192.168.65.1	2026-08-04 19:13:00.978756+05:30	2026-08-18 19:13:00.978756+05:30	\N	2026-08-04 19:13:00.978756+05:30
72abd997-bbf9-4e0e-a856-382f905a0f59	f794726d-934d-4696-b063-33a2e845fbd2	d60bdab043014e60a34de1be3607d35a	curl/8.7.1	192.168.65.1	2026-08-04 19:13:54.943581+05:30	2026-08-18 19:13:54.943581+05:30	\N	2026-08-04 19:13:54.943581+05:30
8911f0f0-9659-437f-8ecb-a47e68050e30	f794726d-934d-4696-b063-33a2e845fbd2	6c224c83c5344bd3aabe3e9bffae075f	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	192.168.65.1	2026-08-04 19:02:43.560047+05:30	2026-08-18 19:02:43.560047+05:30	2026-08-04 19:17:15.661982+05:30	2026-08-04 19:02:43.560047+05:30
3124cbe3-6616-47b9-8314-b9fbab582be5	27f8f754-e990-4d8a-97c7-e54267eb6882	504729ff907b41fb8f2e9b7990319949	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	192.168.65.1	2026-08-04 19:17:28.264568+05:30	2026-08-18 19:17:28.264568+05:30	2026-08-04 19:17:48.797653+05:30	2026-08-04 19:17:28.264568+05:30
abbca9d3-1665-41f1-a2a3-bc12032dc199	f794726d-934d-4696-b063-33a2e845fbd2	20a2044cc168464997e8c9aa9bcfa3cc	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	192.168.65.1	2026-08-04 19:17:54.864247+05:30	2026-08-18 19:17:54.864247+05:30	2026-08-04 19:18:06.892079+05:30	2026-08-04 19:17:54.864247+05:30
fcf4c523-4a7b-43ce-be27-deec97aea161	ba7f437c-69ec-4eb0-917f-020c0390394a	2f046bf701ba490f934c9a3b5a9c007c	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	192.168.65.1	2026-08-04 19:18:18.410726+05:30	2026-08-18 19:18:18.410726+05:30	2026-08-04 19:18:33.415587+05:30	2026-08-04 19:18:18.410726+05:30
aa9a3c58-aa44-47ce-9351-a2bb588ddedb	f794726d-934d-4696-b063-33a2e845fbd2	f0c3eb0c41a249928ac5fe3830005b72	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	192.168.65.1	2026-08-04 19:18:37.10839+05:30	2026-08-18 19:18:37.10839+05:30	\N	2026-08-04 19:18:37.10839+05:30
d0b285b4-915a-401f-a27c-d983b67a48a9	f794726d-934d-4696-b063-33a2e845fbd2	7b9a39a5599a441ab2981a7a156cd381	curl/8.7.1	192.168.65.1	2026-08-04 19:24:47.150319+05:30	2026-08-18 19:24:47.150319+05:30	\N	2026-08-04 19:24:47.150319+05:30
22c86221-bb09-447c-b776-3ef82afad038	f794726d-934d-4696-b063-33a2e845fbd2	2147496ca5d845d89b4de564a839c234	curl/8.7.1	192.168.65.1	2026-08-04 19:25:02.03042+05:30	2026-08-18 19:25:02.03042+05:30	\N	2026-08-04 19:25:02.03042+05:30
f89da9cd-5879-4178-a5a0-ef0ff843d9dd	f794726d-934d-4696-b063-33a2e845fbd2	833d385acc6d43298a35e7519a760ef5	curl/8.7.1	192.168.65.1	2026-08-04 19:25:33.602045+05:30	2026-08-18 19:25:33.602045+05:30	\N	2026-08-04 19:25:33.602045+05:30
74a71e85-e043-45ed-ad07-6ca5043791df	f794726d-934d-4696-b063-33a2e845fbd2	d8612993109e4608925bc679fb45e74f	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	127.0.0.1	2026-08-04 19:32:27.71948+05:30	2026-08-18 19:32:27.71948+05:30	\N	2026-08-04 19:32:27.71948+05:30
0abc2527-525d-4be5-9aa7-d4ac438f9cc6	f794726d-934d-4696-b063-33a2e845fbd2	9f4eb0614f09487196d9e13d77caa09a	curl/8.7.1	127.0.0.1	2026-08-04 19:33:13.57506+05:30	2026-08-18 19:33:13.57506+05:30	\N	2026-08-04 19:33:13.57506+05:30
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: assure
--

COPY public.users (id, full_name, email, phone, department, hashed_password, role_id, status, avatar, last_login, deleted_at, failed_login_count, locked_until, must_reset_password, password_changed_at, created_at, updated_at) FROM stdin;
ba7f437c-69ec-4eb0-917f-020c0390394a	Abhishek Nayak	abhishekn@platum-ai.co.in	9739734302	Platform_engineer	$argon2id$v=19$m=65536,t=3,p=4$NsrPT3rZWRQCLDD9cGRkww$Glj+SdqcBFobkqhPPQQCHcqCxvYYLh6T13mBIdB2bcA	analyst	Active	AN	2026-08-04 19:18:18.37393+05:30	\N	0	\N	f	2026-08-04 19:11:51.198612+05:30	2026-08-04 19:11:51.162353+05:30	2026-08-04 19:18:18.37563+05:30
969a475b-af91-4598-ba1b-3790275014e5	Aarav Mehta	aarav.mehta@radonaix.io	+91 98765 43210	Finance Operations	$argon2id$v=19$m=65536,t=3,p=4$tcdu/szbcQnhA/HsFbEMfg$SmkbxAXyD3ifB+gxHY3KkyA4dD0g2FMA/3rLEF/hmog	supervisor	Active	AM	\N	2026-08-04 19:10:55.276279+05:30	0	\N	f	\N	2026-08-04 18:48:22.338139+05:30	2026-08-04 19:10:55.274374+05:30
10d6ece2-d25c-4bd2-ad77-09d8831c6184	Priya Shah	priya.shah@radonaix.io	+91 99887 12345	Assurance	$argon2id$v=19$m=65536,t=3,p=4$PRTJBM7ARGjAEc+mjJSAcw$4kmB2pR4MBhQT9L+79eIoM4+OWuu4OmlHZVPQjR7lOo	analyst	Active	PS	\N	2026-08-04 19:10:57.475709+05:30	0	\N	f	\N	2026-08-04 18:48:22.338139+05:30	2026-08-04 19:10:57.473881+05:30
1c66b011-d3e9-49f5-9c82-6811d61219cf	Mei Tanaka	mei.tanaka@radonaix.io	+81 90 1234 5678	Compliance	$argon2id$v=19$m=65536,t=3,p=4$mK7OSe0LmG9F8rMJm/0fdA$nEqOjzFteQpLngVOUjdD0EdrBaXpcnh7uSXCjUn84eE	viewer	Active	MT	\N	2026-08-04 19:10:59.691105+05:30	0	\N	f	\N	2026-08-04 18:48:22.338139+05:30	2026-08-04 19:10:59.689006+05:30
941a3fb9-c3bc-4312-a5e2-0545cfcafe68	Liam O'Connor	liam.oconnor@radonaix.io	+353 87 555 1212	Engineering	$argon2id$v=19$m=65536,t=3,p=4$pRLd4PUEn+jH6ne4Nny4fA$JEBtLsRXOo+8Mdn5cMM7xx3I3uLe5bhz5RcIooyzL3A	analyst	Disabled	LO	\N	2026-08-04 19:11:01.362795+05:30	0	\N	f	\N	2026-08-04 18:48:22.338139+05:30	2026-08-04 19:11:01.358585+05:30
27f8f754-e990-4d8a-97c7-e54267eb6882	Manoj B M	manoj@platum-ai.co.in	9324838230428	ML Engineer	$argon2id$v=19$m=65536,t=3,p=4$+iob/Vxof0zaDqKsTYF9lA$c+vAgumcEACTY0j6N52/ImqVzH2Y+A7IA+pmrN63v+w	ml_engineer	Active	MM	2026-08-04 19:17:28.208331+05:30	\N	0	\N	f	2026-08-04 19:12:57.088023+05:30	2026-08-04 19:12:57.052351+05:30	2026-08-04 19:17:28.209717+05:30
f794726d-934d-4696-b063-33a2e845fbd2	Administrator	admin@radonaix.io	+1 415 555 0100	Platform Ops	$argon2id$v=19$m=65536,t=3,p=4$eQOTq09iynHlPYG75EyGpA$XPZXG8iOvvaeQVXWm2/QFzGX+aDmJeLFRXbgYxh5GLU	admin	Active	AD	2026-08-04 19:33:13.525811+05:30	\N	0	\N	f	\N	2026-08-04 18:48:22.338139+05:30	2026-08-04 19:33:13.537541+05:30
\.


--
-- Name: audit_logs pk_audit_logs; Type: CONSTRAINT; Schema: public; Owner: assure
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT pk_audit_logs PRIMARY KEY (id);


--
-- Name: roles pk_roles; Type: CONSTRAINT; Schema: public; Owner: assure
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT pk_roles PRIMARY KEY (id);


--
-- Name: user_sessions pk_user_sessions; Type: CONSTRAINT; Schema: public; Owner: assure
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT pk_user_sessions PRIMARY KEY (id);


--
-- Name: users pk_users; Type: CONSTRAINT; Schema: public; Owner: assure
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT pk_users PRIMARY KEY (id);


--
-- Name: ix_audit_logs_actor; Type: INDEX; Schema: public; Owner: assure
--

CREATE INDEX ix_audit_logs_actor ON public.audit_logs USING btree (actor);


--
-- Name: ix_audit_logs_actor_id; Type: INDEX; Schema: public; Owner: assure
--

CREATE INDEX ix_audit_logs_actor_id ON public.audit_logs USING btree (actor_id);


--
-- Name: ix_audit_logs_at; Type: INDEX; Schema: public; Owner: assure
--

CREATE INDEX ix_audit_logs_at ON public.audit_logs USING btree (at);


--
-- Name: ix_audit_logs_request_id; Type: INDEX; Schema: public; Owner: assure
--

CREATE INDEX ix_audit_logs_request_id ON public.audit_logs USING btree (request_id);


--
-- Name: ix_user_sessions_expires_at; Type: INDEX; Schema: public; Owner: assure
--

CREATE INDEX ix_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);


--
-- Name: ix_user_sessions_refresh_jti; Type: INDEX; Schema: public; Owner: assure
--

CREATE UNIQUE INDEX ix_user_sessions_refresh_jti ON public.user_sessions USING btree (refresh_jti);


--
-- Name: ix_user_sessions_user_id; Type: INDEX; Schema: public; Owner: assure
--

CREATE INDEX ix_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: assure
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_role_id; Type: INDEX; Schema: public; Owner: assure
--

CREATE INDEX ix_users_role_id ON public.users USING btree (role_id);


--
-- Name: audit_logs fk_audit_logs_actor_id_users; Type: FK CONSTRAINT; Schema: public; Owner: assure
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT fk_audit_logs_actor_id_users FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: user_sessions fk_user_sessions_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: assure
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT fk_user_sessions_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users fk_users_role_id_roles; Type: FK CONSTRAINT; Schema: public; Owner: assure
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_role_id_roles FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- PostgreSQL database dump complete
--

\unrestrict UcRzCquTUCwI4INMs4aTbjZFaIrTlBnVXu5guPpqwWO4aEmJdXE9z9lMclFk2vC

