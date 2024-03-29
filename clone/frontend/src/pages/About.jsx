import React from "react";
import MainText from "../components/IntroText";

function About() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-auto">
        <div className="container h-screen mx-auto">
          <MainText />
        </div>
      </div>
    </div>
  );
}

export default About;
