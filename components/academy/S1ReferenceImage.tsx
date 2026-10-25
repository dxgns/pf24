import { S1_FLIGHT_PLAN_IMAGE, S1_LEMH_TAXI_IMAGE } from "@/components/academy/s1ReferenceData";

type Props = {
  questionId: string;
};

export default function S1ReferenceImage({ questionId }: Props) {
  const source = questionId === "q10"
    ? S1_LEMH_TAXI_IMAGE
    : questionId === "q17"
      ? S1_FLIGHT_PLAN_IMAGE
      : null;

  if (!source) return null;

  const alt = questionId === "q10"
    ? "Plano de rodaje LEMH/MAH utilizado para las preguntas 10 y 11"
    : "Plan de vuelo AVA4508 utilizado para las preguntas 17 y 18";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source} alt={alt} className="block h-auto w-full" />
    </div>
  );
}
