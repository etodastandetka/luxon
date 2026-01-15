-- CreateTable
CREATE TABLE "chat_message_templates" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_message_templates_is_active_order_idx" ON "chat_message_templates"("is_active", "order");

