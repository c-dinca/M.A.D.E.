import Beat from "./components/Beat";
import Close from "./components/Close";
import Hero from "./components/Hero";
import Lanes from "./components/Lanes";
import Nav from "./components/Nav";
import Play from "./components/Play";
import { beats } from "./copy";

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        {beats.map((beat) => (
          <Beat key={beat.fig} {...beat} />
        ))}
        <Play />
        <Lanes />
        <Close />
      </main>
    </>
  );
}
