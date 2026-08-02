import { REMEDIATION_VERSION } from "./practiceRecipes.js";

function isValidAttempt(attempt = {}) {
  return attempt.validSession !== false && attempt.benchmarkValid !== false;
}

function isPassedAttempt(attempt = {}) {
  return isValidAttempt(attempt) && attempt.sessionPassed === true;
}

export function getRemediationSummary(attempts = []) {
  const chains = new Map();
  attempts.forEach((attempt) => {
    if (
      attempt.remediationVersion !== REMEDIATION_VERSION
      || !attempt.remediationChainId
      || !["recovery", "reassessment"].includes(attempt.remediationStage)
    ) return;
    const id = String(attempt.remediationChainId);
    const chain = chains.get(id) ?? { id, recovery: [], reassessment: [] };
    chain[attempt.remediationStage].push(attempt);
    chains.set(id, chain);
  });

  const items = [...chains.values()].map((chain) => {
    chain.recovery.sort((a, b) => String(a.completedAt || "").localeCompare(String(b.completedAt || "")));
    chain.reassessment.sort((a, b) => String(a.completedAt || "").localeCompare(String(b.completedAt || "")));
    const firstPassedRecovery = chain.recovery.find((attempt) => (
      isPassedAttempt(attempt) && Boolean(attempt.completedAt)
    ));
    const recoveryPassed = Boolean(firstPassedRecovery);
    const freshReassessments = chain.reassessment.filter((attempt) => (
      attempt.remediationFreshText !== false
      && Boolean(attempt.completedAt)
      && String(attempt.completedAt) > String(firstPassedRecovery?.completedAt || "")
    ));
    const transferChecked = freshReassessments.length > 0;
    const transferPassed = freshReassessments.some(isPassedAttempt);
    return {
      ...chain,
      recoveryPassed,
      transferChecked,
      transferPassed,
      sourceType: chain.recovery[0]?.remediationSourceType ?? chain.reassessment[0]?.remediationSourceType ?? null,
      sourceId: chain.recovery[0]?.remediationSourceId ?? chain.reassessment[0]?.remediationSourceId ?? null,
    };
  });

  const recoveryPassed = items.filter((item) => item.recoveryPassed).length;
  const transferChecked = items.filter((item) => item.transferChecked).length;
  const transferPassed = items.filter((item) => item.transferPassed).length;

  return {
    chainCount: items.length,
    recoveryPassed,
    transferChecked,
    transferPassed,
    pendingTransfer: items.filter((item) => item.recoveryPassed && !item.transferChecked).length,
    transferRate: transferChecked ? (transferPassed / transferChecked) * 100 : 0,
    chains: items,
  };
}
