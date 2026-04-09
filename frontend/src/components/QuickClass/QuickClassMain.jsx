import React, { useState } from "react";
import useCharStore from "../../store/CharStore";
import { InputBlock, AbilityStat, Collapsible, SkillsBlock } from "./Widgets";
import { ABILITY_ORDER } from "../../utils/Constants";

function QuickClassMain() {
  const createQuickClass = useCharStore((s) => s.createQuickClass);

  const [prompt, setPrompt] = useState("");
  const [charName, setCharName] = useState("");
  const [generatingChar, setGeneratingChar] = useState(false);
  const [response, setResponse] = useState(null);

  async function sendPrompt() {
    setGeneratingChar(true);
    const result = await createQuickClass(prompt, charName);
    setResponse(result);
    setGeneratingChar(false);
    console.log(charName);
  }

  return (
    <div className="w-full min-h-screen bg-slate-900">
      {/* Prompt Area */}
      <div className="flex justify-center mt-6">
        <div className="w-full max-w-2xl border border-stone-700 bg-gradient-to-b from-stone-900 via-zinc-950 to-black rounded-lg p-6 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
          <p className="text-sm uppercase tracking-[0.25em] text-red-400 mb-4">
            Who are you?
          </p>

          {/* textarea */}
          <div className="relative p-[2px] bg-gradient-to-b from-stone-600 to-black rounded-md mb-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your character..."
              className="
                w-full h-24 resize-none
                bg-zinc-950 rounded-md
                px-3 py-2
                text-stone-200
                placeholder:text-stone-500
                outline-none
                shadow-[inset_0_0_12px_rgba(0,0,0,0.7)]
                focus:shadow-[inset_0_0_14px_rgba(0,0,0,0.85),0_0_10px_rgba(120,0,0,0.25)]
              "
            />
          </div>

          {/* Name input */}
          <div className="relative p-[2px] bg-gradient-to-b from-stone-600 to-black rounded-md mb-6">
            <input
              type="text"
              value={charName}
              placeholder="Character Name"
              onChange={(e) => setCharName(e.target.value)}
              className="
                w-full
                bg-zinc-950 rounded-md
                px-3 py-2
                text-red-300 font-semibold
                placeholder:text-stone-500
                outline-none
                shadow-[inset_0_0_10px_rgba(0,0,0,0.7)]
                focus:shadow-[inset_0_0_12px_rgba(0,0,0,0.85),0_0_8px_rgba(120,0,0,0.3)]
              "
            />
          </div>

          {/* Button */}
          <button
            onClick={sendPrompt}
            disabled={generatingChar}
            className="
              w-full
              border border-red-900/50
              bg-gradient-to-b from-red-900 to-black
              text-red-300 font-bold uppercase tracking-widest
              py-2 rounded-md
              transition
              hover:from-red-800 hover:text-white
              hover:shadow-[0_0_12px_rgba(120,0,0,0.4)]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {generatingChar ? "Summoning..." : "Create Character"}
          </button>
        </div>
      </div>
      {/* Character Sheet */}
      <div className="py-6 px-20">
        <div className="rounded-lg border-2 border-stone-700 bg-gradient-to-b from-stone-900 via-zinc-950 to-black p-6 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
          {/* Sheet Header */}
          <div className="flex items-center gap-3 mb-6 border-b border-red-900/40 pb-3">
            <h2 className="text-xl font-bold uppercase tracking-[0.2em] text-red-400">
              Character Sheet:
            </h2>

            {response && (
              <div className="">
                <input
                  type="text"
                  value={response.char_name ?? ""}
                  onChange={(e) =>
                    setResponse({
                      ...response,
                      char_name: e.target.value,
                    })
                  }
                  className="
                    bg-transparent
                    text-xl font-bold
                    text-red-300
                    outline-none
                    border-none
                    border-b border-transparent
                    focus:border-red-700
                    px-1
                  "
                />
                <input
                  type="text"
                  value={response.race.name ?? ""}
                  onChange={(e) =>
                    setResponse({
                      ...response,
                      char_name: e.target.value,
                    })
                  }
                  className="
                    bg-transparent
                    text-xl font-bold
                    text-red-300
                    outline-none
                    border-none
                    border-b border-transparent
                    focus:border-red-700
                    px-1
                  "
                />
                <input
                  type="text"
                  value={response.background.name ?? ""}
                  onChange={(e) =>
                    setResponse({
                      ...response,
                      char_name: e.target.value,
                    })
                  }
                  className="
                    bg-transparent
                    text-xl font-bold
                    text-red-300
                    outline-none
                    border-none
                    border-b border-transparent
                    focus:border-red-700
                    px-1
                  "
                />
              </div>
            )}
          </div>

          {/* Sheet Body*/}
          {response && (
            <div className="flex flex-col gap-6">
              {/* General Stats*/}
              <Collapsible title="General Stats">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
                  <InputBlock
                    label="Max HP"
                    type="number"
                    value={response.max_hp}
                    onChange={(e) =>
                      setResponse({
                        ...response,
                        max_hp: Number(e.target.value),
                      })
                    }
                  />
                  <InputBlock
                    label="Total Level"
                    type="number"
                    value={response.total_level}
                    onChange={(e) =>
                      setResponse({
                        ...response,
                        total_level: Number(e.target.value),
                      })
                    }
                  />
                  <InputBlock
                    label="Prof. Bonus"
                    type="number"
                    value={response.pb}
                    onChange={(e) =>
                      setResponse({
                        ...response,
                        pb: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </Collapsible>

              {/* Ability Scores*/}
              <Collapsible title="Ability Scores">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
                  {ABILITY_ORDER.map((ability) => (
                    <AbilityStat
                      key={ability}
                      label={ability.toUpperCase()}
                      data={response.abilities[ability]}
                      onChange={(field, value) =>
                        setResponse({
                          ...response,
                          abilities: {
                            ...response.abilities,
                            [ability]: {
                              ...response.abilities[ability],
                              [field]: value,
                            },
                          },
                        })
                      }
                    />
                  ))}
                </div>
              </Collapsible>

              {/* Class Data*/}
              <Collapsible title="Classes">
                {response.classes.map((cls, i) => (
                  <Collapsible
                    key={i}
                    title={
                      <div className="flex items-baseline gap-2">
                        <span className="text-red-400 font-semibold tracking-wider italic">
                          {cls.sub_class}
                        </span>
                        <span className="text-amber-500">{cls.name}</span>
                        <span className="text-gray-300">
                          level: {cls.level}
                        </span>
                      </div>
                    }
                  >
                    <div className="flex flex-col gap-2">
                      {Object.entries(cls.class_data).map(
                        ([lvl, lvlFeatures]) => (
                          <Collapsible
                            key={`${i}-lvl-${lvl}`}
                            title={
                              <div className="flex items-baseline gap-2">
                                <span className="text-stone-300 font-semibold">
                                  Level {lvl}
                                </span>
                                <span className="text-stone-500 text-xs uppercase tracking-wider">
                                  {lvlFeatures.length} feature
                                  {lvlFeatures.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                            }
                          >
                            <div className="flex flex-col gap-2">
                              {lvlFeatures.map((feature, featureIndex) => (
                                <Collapsible
                                  key={`${i}-${lvl}-${featureIndex}`}
                                  title={
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-stone-200 font-medium">
                                        {feature.name}
                                      </span>
                                      <span
                                        className={
                                          feature.feature_type === "sub_class"
                                            ? "text-red-400 text-xs uppercase tracking-wider"
                                            : "text-amber-500 text-xs uppercase tracking-wider"
                                        }
                                      >
                                        {feature.feature_type}
                                      </span>
                                    </div>
                                  }
                                >
                                  <div className="rounded-md border border-stone-800 bg-black/30 p-3">
                                    <p className="whitespace-pre-line text-sm text-stone-300">
                                      {feature.notes}
                                    </p>
                                  </div>
                                </Collapsible>
                              ))}
                            </div>
                          </Collapsible>
                        ),
                      )}
                    </div>
                  </Collapsible>
                ))}
              </Collapsible>

              {/* Race Data*/}
              <Collapsible
                title={
                  <div className="flex items-baseline gap-2">
                    <span className="text-amber-500 font-semibold">
                      {response.race.name}
                    </span>

                    {response.race.subrace?.name && (
                      <span className="text-red-400 italic tracking-wider">
                        {response.race.subrace.name}
                      </span>
                    )}
                  </div>
                }
              >
                <div className="flex flex-col gap-3">
                  {/* Race details */}
                  <div className="rounded-md border border-stone-800 bg-black/30 p-3">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {response.race.size && (
                        <div className="rounded-md border border-stone-800 bg-zinc-950 p-2">
                          <p className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                            Size
                          </p>
                          <p className="text-stone-200">{response.race.size}</p>
                        </div>
                      )}

                      {response.race.creature_type && (
                        <div className="rounded-md border border-stone-800 bg-zinc-950 p-2">
                          <p className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                            Creature Type
                          </p>
                          <p className="text-stone-200">
                            {response.race.creature_type}
                          </p>
                        </div>
                      )}

                      {response.race.movements &&
                        Object.keys(response.race.movements).length > 0 && (
                          <div className="rounded-md border border-stone-800 bg-zinc-950 p-2">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                              Movement
                            </p>
                            <div className="flex flex-col gap-1">
                              {Object.entries(response.race.movements).map(
                                ([moveType, value]) => (
                                  <p key={moveType} className="text-stone-200">
                                    <span className="text-stone-400 capitalize">
                                      {moveType}:
                                    </span>{" "}
                                    {value}
                                  </p>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                      {response.race.senses &&
                        Object.keys(response.race.senses).length > 0 && (
                          <div className="rounded-md border border-stone-800 bg-zinc-950 p-2">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                              Senses
                            </p>
                            <div className="flex flex-col gap-1">
                              {Object.entries(response.race.senses).map(
                                ([sense, value]) => (
                                  <p key={sense} className="text-stone-200">
                                    <span className="text-stone-400 capitalize">
                                      {sense}:
                                    </span>{" "}
                                    {value}
                                  </p>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Race traits */}
                  {response.race.traits?.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {response.race.traits.map((trait, i) => (
                        <Collapsible
                          key={`race-trait-${i}`}
                          title={
                            <span className="text-stone-200 font-medium">
                              {trait.name}
                            </span>
                          }
                        >
                          <div className="rounded-md border border-stone-800 bg-black/30 p-3">
                            <p className="whitespace-pre-line text-sm text-stone-300">
                              {trait.notes}
                            </p>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  )}

                  {/* Subrace traits */}
                  {response.race.subrace && (
                  <div className="rounded-md border border-stone-800 bg-black/30 p-3">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-red-400">
                      Subrace
                    </p>

                    <p className="text-stone-200 font-medium">
                      {response.race.subrace.name}
                    </p>

                    {response.race.subrace.notes && (
                      <p className="mt-2 whitespace-pre-line text-sm text-stone-300">
                        {response.race.subrace.notes}
                      </p>
                    )}
                  </div>
                )}
                </div>
              </Collapsible>

              {/* Skills*/}
              <SkillsBlock
                skills={response.skills}
                response={response}
                setResponse={setResponse}
              />

              {/* Feats */}
              <Collapsible title="Feats">
                <div className="flex flex-col gap-2">
                  {response.feats.map((feat, i) => (
                    <Collapsible
                      key={i}
                      title={
                        <span className="text-stone-200 font-medium">
                          {feat.name}
                        </span>
                      }
                    >
                      <div className="rounded-md border border-stone-800 bg-black/30 p-3">
                        <p className="whitespace-pre-line text-sm text-stone-300">
                          {feat.notes}
                        </p>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              </Collapsible>

              

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default QuickClassMain;
