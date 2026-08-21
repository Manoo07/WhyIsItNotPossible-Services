-- CreateEnum
CREATE TYPE "AuthorApplicationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum
ALTER TYPE "AuditTargetType" ADD VALUE 'author_application';

-- CreateTable
CREATE TABLE "author_applications" (
    "id" SERIAL NOT NULL,
    "applicant_id" INTEGER NOT NULL,
    "pitch" TEXT NOT NULL,
    "portfolio_url" TEXT,
    "status" "AuthorApplicationStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by_id" INTEGER,
    "decision_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "author_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "author_applications_status_idx" ON "author_applications"("status");

-- AddForeignKey
ALTER TABLE "author_applications" ADD CONSTRAINT "author_applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_applications" ADD CONSTRAINT "author_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
