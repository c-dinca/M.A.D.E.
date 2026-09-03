type Props = {
  size?: "nav" | "hero";
};

export default function Wordmark({ size = "nav" }: Props) {
  return (
    <span className={`wordmark wordmark-${size}`} aria-label="scenio">
      scen
      <span className="i">
        ı
        <span className="dot" aria-hidden="true" />
      </span>
      o
    </span>
  );
}
