export default function ScopeNativeListCss() {
  return (
    <style>{`
      /* The original PF24Scope list bodies are legacy placeholders only.
         Keep them hidden from the very first paint; live list content is
         rendered by ScopeOperationalSyncV2 as a separate portal sibling. */
      main.fixed > section > div.absolute.z-30.w-\[462px\] > :nth-child(2),
      main.fixed > section > div.absolute.z-30.w-\[190px\] > :nth-child(2),
      main.fixed > section > div.absolute.z-30.w-\[134px\] > :nth-child(2) {
        display: none !important;
      }
    `}</style>
  );
}
