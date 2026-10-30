import type { ReactNode } from "react";
import { Details } from "./AtlasUI";

/** Primary sources only; each was opened and matched before it was listed here (2026-10-31). */
const SRC = {
  ncsc: "https://www.ncsc.gov.uk/whitepaper/next-steps-preparing-for-post-quantum-cryptography",
  fips: "https://www.nist.gov/news-events/news/2024/08/nist-releases-first-3-finalized-post-quantum-encryption-standards",
  fips203: "https://csrc.nist.gov/pubs/fips/203/final",
  fips204: "https://csrc.nist.gov/pubs/fips/204/final",
  fips205: "https://csrc.nist.gov/pubs/fips/205/final",
  ir8547: "https://csrc.nist.gov/pubs/ir/8547/ipd",
  rbi: "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12562",
  certin: "https://www.cert-in.org.in/Directions70B.jsp",
};

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener"
    className="underline underline-offset-4 hover:text-fg"
  >
    {children}
  </a>
);

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-body font-medium text-fg">{title}</h2>
      {children}
    </section>
  );
}

/** "Why banks need this now": closed by default, at the top of the pipeline. */
export function WhyBanks() {
  return (
    <Details summary="Why banks need this now">
      <div className="grid gap-6 md:grid-cols-2">
        <Part title="The threat">
          <p>
            A large enough quantum computer running Shor’s algorithm breaks RSA and elliptic-curve
            cryptography. Encrypted traffic recorded today can be decrypted then: harvest now,
            decrypt later (<A href={SRC.ncsc}>UK NCSC</A>).
          </p>
        </Part>
        <Part title="Standards and regulation">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              NIST published the first post-quantum standards in August 2024 (
              <A href={SRC.fips}>announcement</A>): <A href={SRC.fips203}>FIPS 203</A> ML-KEM,{" "}
              <A href={SRC.fips204}>FIPS 204</A> ML-DSA, <A href={SRC.fips205}>FIPS 205</A> SLH-DSA.
            </li>
            <li>
              <A href={SRC.ir8547}>NIST IR 8547</A> (initial public draft) proposes deprecating
              112-bit RSA and elliptic-curve algorithms after 2030 and disallowing them after 2035.
            </li>
            <li>
              RBI’s{" "}
              <A href={SRC.rbi}>
                IT Governance, Risk, Controls and Assurance Practices Directions, 2023
              </A>{" "}
              (RBI/2023-24/107, 7 Nov 2023, in force 1 Apr 2024) set the IT and cyber-risk
              governance banks are reviewed against.
            </li>
            <li>
              <A href={SRC.certin}>CERT-In directions</A> under section 70B(6) of the IT Act (28 Apr
              2022) cover information security practices and cyber-incident reporting.
            </li>
          </ul>
          <p className="text-small text-fg-3">
            Neither RBI nor CERT-In is cited here as mandating post-quantum cryptography; they are
            the governance context the evidence below supports.
          </p>
        </Part>
        <Part title="Why banks">
          <p>
            Account, loan and KYC records must stay confidential for years, longer than the time
            many expect before a quantum threat. Netbanking, UPI apps and partner APIs all run over
            TLS whose key exchange can be recorded today. Audit trails must stay provable for as
            long as they are kept.
          </p>
        </Part>
        <Part title="What this adds">
          <p>
            An inventory with evidence, a provably optimal migration plan within team capacity, an
            explained patch order (ML-KEM for key exchange, ML-DSA for signatures), handshake gates
            on real TLS 1.3, and every step signed with ML-DSA-65 so an auditor can re-verify it.
          </p>
        </Part>
      </div>
    </Details>
  );
}
