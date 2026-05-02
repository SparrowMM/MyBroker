import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 45%, #4f46e5 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          borderRadius: 8,
        }}
      >
        M
      </div>
    ),
    { ...size },
  );
}
