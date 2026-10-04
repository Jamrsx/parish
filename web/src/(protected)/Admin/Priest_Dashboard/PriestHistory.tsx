import React from "react";
import PriestPageShell from "./components/PriestPageShell";
import ParishHistory from "../components/history/ParishHistory";

const PriestHistory: React.FC = () => (
  <PriestPageShell subtitle="parish history (view only)">
    <ParishHistory scope="priest" />
  </PriestPageShell>
);

export default PriestHistory;
