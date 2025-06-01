-- DropForeignKey
ALTER TABLE "processing_jobs" DROP CONSTRAINT "processing_jobs_data_source_id_fkey";

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
