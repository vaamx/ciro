const db = require('./src/db');

async function checkTables() {
  try {
    console.log("Checking if workspaces table exists...");
    const hasWorkspaces = await db.schema.hasTable('workspaces');
    console.log("workspaces table exists:", hasWorkspaces);
    
    if (hasWorkspaces) {
      const workspaces = await db('workspaces').select('*');
      console.log("workspaces records:", workspaces);
    }
    
    console.log("Checking if workspace_charts table exists...");
    const hasWorkspaceCharts = await db.schema.hasTable('workspace_charts');
    console.log("workspace_charts table exists:", hasWorkspaceCharts);
    
    if (hasWorkspaceCharts) {
      const charts = await db('workspace_charts').select('*');
      console.log("workspace_charts records:", charts);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit();
  }
}

checkTables();
