'use strict';

const authorityRank = {
  police: 100,
  hospital: 95,
  rescue_authority: 90,
  district_administration: 85,
  local_government: 80,
  family_first_hand: 75,
  established_media: 60,
  aggregator: 30
};

function deriveCurrentStatus(events) {
  if (!events || !events.length) return { status: 'STATUS_UNKNOWN', basis: null };
  const ordered = [...events].sort((a, b) => {
    const da = new Date(a.effective_date || a.publication_date || 0).getTime();
    const db = new Date(b.effective_date || b.publication_date || 0).getTime();
    if (db !== da) return db - da;
    return (authorityRank[b.authority_type] || 0) - (authorityRank[a.authority_type] || 0);
  });
  return { status: ordered[0].status, basis: ordered[0].status_event_id };
}

module.exports = { deriveCurrentStatus, authorityRank };
