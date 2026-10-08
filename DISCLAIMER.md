# Disclaimer

**Last updated: October 8, 2026**

## General Disclaimer

TrustScan ("the Software") is an **analysis and indicator-reporting tool**. It inspects
publicly visible technical signals of a website — such as TLS configuration, HTTP security
headers, DNS records, domain registration data, redirect behavior, and reputation indicators —
and presents them in a human-readable dashboard.

**TrustScan does not certify, guarantee, or warrant that any website is safe, secure, or
trustworthy.** A high score means *fewer risk indicators were detected at the time of the scan*.
It does **not** mean the website is free from malware, phishing, scams, or other threats.
Conversely, a low score does not prove a website is malicious — it means *more risk indicators
were detected* and further caution is advised.

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT,
OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

## Accuracy of Information

- Scan results reflect **a single point in time**. Website configurations, certificates,
  DNS records, and domain registrations can change at any moment after a scan is completed.
- Data is gathered from **third-party sources** (DNS-over-HTTPS resolvers, RDAP registries,
  certificate transparency logs, optional Google Safe Browsing). The accuracy, availability,
  and timeliness of these sources are outside the Software's control.
- **Reputation data is not exhaustive.** Without a Google Safe Browsing API key, reputation
  is estimated from technical signals (domain age, DNSSEC, TLS posture, headers) and is
  explicitly labeled as a *heuristic estimate* — it is capped and never presented as certainty.
- **Simulated results** (when live checks are disabled or unavailable) are generated
  deterministically for demonstration and training purposes. They do **not** reflect the
  actual state of any real website.

## Limitation of Liability

IN NO EVENT SHALL THE AUTHORS, CONTRIBUTORS, OR DISTRIBUTORS OF TRUSTSCAN BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES — INCLUDING
WITHOUT LIMITATION LOST DATA, LOST PROFITS, SYSTEM DOWNTIME, OR SECURITY INCIDENTS — ARISING
FROM THE USE OF, RELIANCE ON, OR INABILITY TO USE THE SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGES.

You use TrustScan **entirely at your own risk**. Decisions to visit, trust, submit information
to, or download files from any website are **solely your responsibility**.

## Not Security Advice

Nothing in the Software constitutes professional security advice, a security audit, a
penetration test, or a compliance assessment (e.g., PCI-DSS, ISO 27001, SOC 2). Organizations
requiring formal security assurance should engage qualified security professionals.

## Third-Party Services

TrustScan may query the following third-party services during a scan. Their own terms of
service and privacy policies apply:

| Service | Purpose |
|---|---|
| Cloudflare / Google DNS-over-HTTPS | DNS record lookups (A, AAAA, MX, NS, DNSSEC) |
| IANA RDAP bootstrap + registrar RDAP | Domain registration data |
| crt.sh | Certificate transparency log lookups |
| Google Safe Browsing API *(optional)* | Live threat-intelligence lookups |
| ipwho.is / ip-api.com | IP-to-ASN mapping |

The Software's authors have no affiliation with these services and are not responsible for
their content, availability, or practices.

## Responsible Use

TrustScan is intended for **defensive and educational purposes**: helping users make more
informed decisions about websites they visit. Do not use the Software to:

- Harass, intimidate, or target any individual or organization.
- Circumvent security controls or access systems without authorization.
- Misrepresent scan results to deceive others about a website's safety or legitimacy.

## Privacy

All analysis runs **locally in your browser**. Scan history and settings are stored only in
`chrome.storage.local` on your device. The Software does not upload scan data to any server.
However, as noted above, individual scan steps query third-party APIs (DoH, RDAP, crt.sh,
etc.) which will see the domain names you analyze. Review those services' privacy policies
for details.

## Changes to This Disclaimer

This disclaimer may be updated from time to time. The "Last updated" date at the top
reflects the most recent revision. Continued use of the Software after changes constitutes
acceptance of the updated disclaimer.

---

**By installing or using TrustScan, you acknowledge that you have read, understood, and
agree to this disclaimer.**
