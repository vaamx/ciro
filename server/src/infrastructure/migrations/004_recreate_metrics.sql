-- Drop existing metrics table and its trigger if they exist
DROP TRIGGER IF EXISTS update_metrics_updated_at ON metrics;
DROP TABLE IF EXISTS metrics;

-- Create metrics table
CREATE TABLE metrics (
    id SERIAL PRIMARY KEY,
    dashboard_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    timeframe VARCHAR(50),
    trend JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
);

-- Create trigger for updated_at on metrics
CREATE TRIGGER update_metrics_updated_at
    BEFORE UPDATE ON metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 