/**
 * The couple's two names, person1 first, each with the Bride/Groom-style role
 * the couple picked when it is known: "Prabhjeet (Groom) & Jasleen (Bride)".
 * Works on any event shape: people rows when loaded, else the name columns.
 */
export function coupleLabel(ev, empty = '—') {
  if (!ev) return empty;
  const people = Array.isArray(ev.people) ? ev.people : [];
  const one = (slot, column) => {
    const row = people.find((p) => p.role === slot);
    const name = row?.name || column || '';
    if (!name) return '';
    const choice = row?.extraData?.role_choice;
    return choice ? `${name} (${choice})` : name;
  };
  return [one('person1', ev.person1Name), one('person2', ev.person2Name)].filter(Boolean).join(' & ') || empty;
}
