import type { TestCategory } from './index'

export const emailTracking: TestCategory = {
  id: 'email-tracking',
  name: 'Śledzenie e-mail',
  tests: [
    { name: 'Mailchimp Tracking', url: 'https://list-manage.com/track/open.php' },
    { name: 'Mailgun Tracking', url: 'https://email.mailgun.net/o/0' },
    { name: 'HubSpot Email Tracking', url: 'https://track.hubspot.com/__ptq.gif' },
    { name: 'Constant Contact', url: 'https://r20.rs6.net/on.jsp' },
    { name: 'Campaign Monitor', url: 'https://cmail.createsend.com/t/y-o-0-0/' },
    { name: 'Return Path', url: 'https://bl.returnpath.net/' },
    { name: 'SendGrid Tracking', url: 'https://u0.ct.sendgrid.net/wf/open' },
    { name: 'Klaviyo Email', url: 'https://trk.klclick.com/' },
    { name: 'ActiveCampaign Email', url: 'https://lt.actcampaign.com/open' },
    { name: 'Brevo (Sendinblue)', url: 'https://sibautomation.com/sa.js' },
    { name: 'ConvertKit', url: 'https://f.convertkit.com/ckjs/ck.5.js' },
    { name: 'Drip Email', url: 'https://tag.getdrip.com/0.js' },
  ],
}
