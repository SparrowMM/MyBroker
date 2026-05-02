export type DailyRecordDto = {
  id: number;
  record_date: string;
  raw_text: string;
  chat_text: string;
  screenshot_paths: string[];
  screenshot_notes: string;
  analysis_summary: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type RecordPayload = {
  record_date: string;
  raw_text: string;
  chat_text: string;
  screenshot_notes: string;
  screenshot_paths?: string[];
};
