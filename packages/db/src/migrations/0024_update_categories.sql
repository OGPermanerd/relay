-- Migrate categories from technical to use-case taxonomy
-- prompt → productivity, workflow → wiring, agent → code, mcp → wiring
UPDATE skills SET category = 'productivity' WHERE category = 'prompt';
UPDATE skills SET category = 'wiring' WHERE category = 'workflow';
UPDATE skills SET category = 'code' WHERE category = 'agent';
UPDATE skills SET category = 'wiring' WHERE category = 'mcp';
