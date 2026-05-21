export type BrokerPriorityItem = {
  title: string;
  reason: string;
  kind: "work" | "life" | "mixed";
};

export type BrokerPriorities = {
  review_date: string;
  generated_at: string;
  source: "llm" | "fallback";
  top_three: BrokerPriorityItem[];
  decision: {
    question: string;
    options: string[];
    recommendation: string;
  };
  broker_note: string;
};

export type BrokerDailyReview = {
  review_date: string;
  generated_at: string;
  source: "llm" | "fallback";
  markdown: string;
};
