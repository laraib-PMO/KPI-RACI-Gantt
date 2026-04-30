-- Attimo PMO Database Schema
-- Run this in Supabase SQL Editor (Step 1 of setup guide)

-- ═══ TASKS (Company Gantt milestones) ═══
CREATE TABLE tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  dept TEXT NOT NULL DEFAULT 'PMO',
  owner TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'To Do' CHECK (status IN ('To Do', 'Doing', 'Done')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  risk TEXT NOT NULL DEFAULT 'On track' CHECK (risk IN ('On track', 'At risk', 'Off track')),
  deps TEXT[] DEFAULT '{}',
  section TEXT DEFAULT 'intermediate',
  external_id TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ RACI MATRIX ═══
CREATE TABLE raci (
  id SERIAL PRIMARY KEY,
  dept TEXT NOT NULL,
  task TEXT NOT NULL,
  responsible TEXT DEFAULT '',
  accountable TEXT DEFAULT '',
  consulted TEXT DEFAULT '',
  informed TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_suggestion BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ RISKS ═══
CREATE TABLE risks (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  impact TEXT NOT NULL CHECK (impact IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  owner TEXT NOT NULL,
  mitigation TEXT DEFAULT '',
  linked_to TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ KPIs ═══
CREATE TABLE kpis (
  id SERIAL PRIMARY KEY,
  dept TEXT NOT NULL,
  name TEXT NOT NULL,
  target TEXT DEFAULT '',
  current_value TEXT DEFAULT '',
  flag TEXT DEFAULT 'green' CHECK (flag IN ('green', 'yellow', 'red')),
  review_rhythm TEXT DEFAULT 'Weekly',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ MEETINGS ═══
CREATE TABLE meetings (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  schedule TEXT DEFAULT '',
  duration TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  attendees TEXT DEFAULT '',
  output TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ AUTO-UPDATE TIMESTAMP ═══
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER risks_updated BEFORE UPDATE ON risks FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER kpis_updated BEFORE UPDATE ON kpis FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ═══ ENABLE REALTIME (so all users see changes instantly) ═══
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE risks;
ALTER PUBLICATION supabase_realtime ADD TABLE kpis;

-- ═══ ROW LEVEL SECURITY (open access — add auth later) ═══
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE raci ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON raci FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON risks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON kpis FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON meetings FOR ALL USING (true) WITH CHECK (true);

-- ═══ SEED DATA — TASKS ═══
INSERT INTO tasks (id, name, dept, owner, start_date, end_date, status, priority, risk, deps, section) VALUES
('1','GTM strategy doc','Marketing','Claire','2026-04-29','2026-04-29','Done','Medium','On track','{}','intermediate'),
('2','MVP scope locked','Leadership','Efehan','2026-04-30','2026-04-30','To Do','High','At risk','{}','intermediate'),
('3','Full Stack Dev shortlist','Hiring','Syed (gap)','2026-04-30','2026-04-30','To Do','High','Off track','{}','intermediate'),
('4','Designer hire decision','Hiring','Efehan+Tunc','2026-04-28','2026-04-30','Doing','High','At risk','{}','intermediate'),
('5','LEGAL-01 T&Cs','Legal','Hikmet+SooLing','2026-04-28','2026-05-01','Doing','Medium','On track','{}','intermediate'),
('6','Messaging doc final','Marketing','Claire','2026-04-28','2026-05-01','Doing','Medium','On track','{}','intermediate'),
('7','Core flows wireframed','Design','Gamze','2026-05-02','2026-05-05','To Do','Medium','On track','{2}','intermediate'),
('8','Gantt locked in tools','PMO','Laraib','2026-05-05','2026-05-06','To Do','High','On track','{2}','intermediate'),
('9','SDK sandbox shipped','Architecture','Talha','2026-05-05','2026-05-08','To Do','High','On track','{}','intermediate'),
('10','Freemium scope','Leadership','Efehan+Syed+SL','2026-05-05','2026-05-08','To Do','High','Off track','{}','intermediate'),
('11','Landing page live','Development','Syed gap','2026-04-28','2026-05-07','To Do','High','At risk','{}','7may'),
('12','Social handles active','Marketing','Suche','2026-05-05','2026-05-07','To Do','Low','On track','{11}','7may'),
('13','Brand bible signed off','Marketing','Efehan+Claire','2026-05-02','2026-05-07','Doing','High','At risk','{4}','7may'),
('14','Initial prototype','Design','Gamze','2026-05-02','2026-05-07','To Do','Medium','On track','{7}','7may'),
('15','Design system','Design','Gamze','2026-04-28','2026-05-07','Doing','Medium','On track','{}','7may'),
('16','Operating cadence live','PMO','Laraib','2026-04-28','2026-05-07','Doing','High','On track','{}','7may'),
('17','Company Gantt locked','PMO','Laraib+Efehan','2026-05-05','2026-05-07','To Do','High','On track','{8}','7may'),
('18','GTM validated','Marketing','Claire','2026-05-19','2026-05-21','To Do','High','On track','{6}','21may'),
('19','Product UI demo-able','Design','Gamze+Talha','2026-05-08','2026-05-21','To Do','High','On track','{9,14}','21may'),
('20','Design partner pipeline','Leadership','Efehan','2026-05-08','2026-05-21','To Do','High','At risk','{}','21may'),
('21','Phase 0 ~85%','Architecture','Talha','2026-04-28','2026-05-21','Doing','High','On track','{}','21may'),
('22','assert_state spec','Architecture','Syed','2026-05-01','2026-05-21','To Do','High','Off track','{}','21may'),
('23','Method validation','AI/Science','Soo Ling','2026-05-12','2026-05-21','To Do','Medium','On track','{}','21may'),
('24','First month KPIs','PMO','Laraib','2026-05-07','2026-05-21','To Do','Medium','On track','{16}','21may'),
('25','Phase 0 complete','Architecture','Talha','2026-04-28','2026-06-12','Doing','High','On track','{21}','launch'),
('26','7 HITL gates','Development','Talha+Syed','2026-05-26','2026-06-12','To Do','High','On track','{25}','launch'),
('27','Partners on staging','Leadership','Efehan+Syed','2026-06-01','2026-06-12','To Do','High','At risk','{25,20}','launch'),
('28','Launch-ready UI','Design','Gamze','2026-05-21','2026-06-12','To Do','High','On track','{19}','launch'),
('29','Final launch QA','Development','Talha+Syed+SL','2026-06-08','2026-06-12','To Do','High','On track','{25,28}','launch'),
('30','Launch campaign','Marketing','Claire+Suche','2026-06-08','2026-06-12','To Do','High','On track','{18}','launch'),
('31','BIM method + paper','AI/Science','Soo Ling','2026-05-21','2026-06-12','To Do','Medium','On track','{23}','launch'),
('32','Pitch deck final','Marketing','Claire','2026-06-15','2026-07-01','To Do','High','On track','{30}','pitch'),
('33','Stable product','Development','Talha+Syed','2026-06-12','2026-07-01','To Do','High','On track','{29}','pitch'),
('34','Partner case study','Marketing','Claire+Efehan','2026-06-12','2026-07-01','To Do','High','At risk','{27}','pitch'),
('35','Research summary','AI/Science','Soo Ling','2026-06-15','2026-07-01','To Do','Medium','On track','{31}','pitch'),
('36','Post-launch retro','PMO','Laraib','2026-06-25','2026-07-01','To Do','Low','On track','{29}','pitch');

-- ═══ SEED DATA — RISKS ═══
INSERT INTO risks (id, description, impact, status, owner, mitigation) VALUES
('R01','Syed on leave - CTO gap','CRITICAL','ACTIVE','Efehan','Decide coverage: LP, shortlist, assert_state, Orbital, freemium'),
('R02','Talha = single point of failure','CRITICAL','ACTIVE','Efehan','Weekly knowledge transfer. No other mitigation.'),
('R03','7 May at risk (LP + brand)','HIGH','ACTIVE','Efehan','Designer by 30 Apr or descope to 21 May'),
('R04','Design chain zero buffer','HIGH','ACTIVE','Laraib','MVP scope lock 30 Apr. L3 if not.'),
('R05','13d freemium to GTM','HIGH','ACTIVE','Efehan+Claire','Partial decisions before 8 May'),
('R06','No partner outreach','HIGH','ACTIVE','Efehan','Start now.'),
('R07','Designer not confirmed','HIGH','ACTIVE','Efehan+Tunc','Confirm 30 Apr'),
('R08','assert_state no owner','HIGH','ACTIVE','Efehan','Talha drafts for Syed to validate'),
('R09','Soo Ling overloaded','MEDIUM','ACTIVE','Laraib','Move DOC-01 or reduce oversight'),
('R10','Dev doc blank','MEDIUM','ACTIVE','Laraib','Chase Syed on return'),
('R11','Post-launch support','MEDIUM','FUTURE','Efehan','Plan before launch');

-- ═══ SEED DATA — RACI ═══
INSERT INTO raci (dept, task, responsible, accountable, consulted, informed, notes, is_suggestion) VALUES
('Development','Phase 0 delivery','Talha','Syed','Soo Ling','Laraib','Syed reviews weekly',true),
('Development','assert_state spec','Syed','Syed','Talha','Laraib','Efehan/Talha draft',true),
('Development','Landing page','Syed','Syed','Talha,Claire','Laraib,Efehan','Talha backup',true),
('Development','Backend sandbox','Talha','Talha','Syed','Laraib','Sole owner',false),
('Development','Full Stack hire','Syed','Efehan','--','Laraib','Efehan interviews',true),
('Design','Core user flows','Gamze','Tunc','Syed','Efehan','',false),
('Design','MVP UX/UI','Gamze','Tunc','Syed','Efehan','',false),
('Design','Orbital View','Gamze','Tunc','Syed,Talha','Efehan','',false),
('Design','Launch QA','Gamze','Tunc','Talha,Syed','Laraib','',false),
('Design','Competitor analysis','Suche','Claire','Gamze','Laraib','Suche started',true),
('Marketing','Positioning','Claire','Efehan','Suche','Laraib','Sub: Suche',false),
('Marketing','Brand bible','Claire+Designer','Efehan','Claire','Laraib','',false),
('Marketing','GTM plan','Claire','Efehan','Suche','Laraib','Sub: Suche',false),
('Marketing','HubSpot CRM','Claire/Syed','Claire','Efehan','Laraib','Claire content',true),
('Marketing','Launch campaign','Claire/Suche','Claire','Efehan','Laraib','Sub: Suche',false),
('Marketing','Partner outreach','Efehan','Efehan','Claire','Laraib','No owner yet',true),
('AI/Science','Research direction','Soo Ling','Soo Ling','Efehan','Laraib','',false),
('AI/Science','LLM experiments','Burak','Soo Ling','--','Laraib','',false),
('AI/Science','Non-LLM experiments','Murat','Soo Ling','--','Laraib','',false),
('AI/Science','GDPR/KVKK audit','Soo Ling','Soo Ling','Hikmet,Syed','Laraib','',false),
('AI/Science','Eval suite','SooLing+Burak','Soo Ling','Talha','Laraib','Blocked',true),
('PMO','Weekly cadence','Laraib','Laraib','Efehan,Nil','All leads','Sub: Mesude',false),
('PMO','Decision log+risk','Laraib','Laraib','Efehan,Nil','All leads','Sub: Mesude',false),
('PMO','Gantt maintenance','Laraib','Laraib','Efehan','All leads','Sub: Mesude',false),
('PMO','Board hygiene','Mesude','Laraib','--','Dept leads','',false),
('PMO','Daily standup','Laraib','Laraib','--','All','Sub: Mesude',false);

-- ═══ SEED DATA — KPIs ═══
INSERT INTO kpis (dept, name, target, current_value, flag, review_rhythm) VALUES
('PMO','Blocked-item age','No blocker >7d','2 open >7d','red','Weekly'),
('PMO','Priority work owned','>=95%','~70%','red','Weekly'),
('PMO','Action close rate','>=80%','Starting','yellow','Weekly'),
('Marketing','GTM doc','29 Apr','Submitted','green','Weekly'),
('Marketing','ICP definition','30 Apr','In Progress','yellow','Weekly'),
('Marketing','Channel readiness','100%','~40%','yellow','Weekly'),
('AI/Science','Insight generation','Continuous','Active','green','Weekly'),
('AI/Science','Throughput','Weekly','Active','green','Weekly'),
('Design','Launch flows','100%','~15%','yellow','Bi-Weekly'),
('Design','Demo prototype','By deadline','Not started','red','Weekly'),
('Development','Phase 0','100% by Jun','~30%','yellow','Weekly'),
('Development','Landing page','7 May','No owner','red','Weekly');

-- ═══ SEED DATA — MEETINGS ═══
INSERT INTO meetings (type, name, schedule, duration, owner, attendees, output) VALUES
('Weekly','Leadership Review','Monday','45m','Laraib','Efehan, all leads','Top 3 priorities; blockers'),
('Weekly','Release Readiness','Wednesday','30m','Syed(Talha)','Laraib, SooLing, Gamze','Readiness; risks'),
('Weekly','Friday Retro','Friday','45m','Laraib','All dept leads','Retro; close rate; Gantt'),
('Weekly','Daily Standup','Daily 4pm','--','Laraib','All channels','3-bullet per person'),
('Milestone','Gantt Lock','2/5 May','60m','Laraib+Efehan','Efehan, Laraib','Gantt locked'),
('Milestone','Design+Dev Sync','8-10 May','60m','Laraib','Gamze, Talha','SDK, IA, frontend'),
('Milestone','GTM Workshop','21 May','90m','Efehan','Claire + external','GTM validated'),
('Milestone','Launch Sync','8-12 Jun','30m','Laraib','All leads','Daily readiness'),
('Milestone','Pitch Day','1 Jul','--','Efehan','All','--'),
('Bi-weekly','6-Week Plan','Every 2wk','45m','Laraib','Efehan, all leads','Plan adjusted'),
('Monthly','RACI Review','Monthly','45m','Laraib','Efehan, all leads','Overlaps; triggers'),
('Monthly','KPI Scorecard','Monthly','30m','Laraib','Efehan, all leads','KPI trends; red flags');
