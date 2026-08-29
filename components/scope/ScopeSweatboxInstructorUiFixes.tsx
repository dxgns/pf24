"use client";

export default function ScopeSweatboxInstructorUiFixes(_: { canInstruct: boolean }) {
  return <style jsx global>{`
    html[data-pf24-sweatbox-active='true'] [data-pf24-live-sector-list='true']:not([data-pf24-sweatbox-sector-layer='true']){display:none!important}
    [data-pf24-sweatbox-toolbar='true']{top:0!important;right:0!important;height:21px!important;border:0!important;box-shadow:none!important;background:#064a40!important}
    [data-pf24-sweatbox-toolbar='true']>button{height:21px!important;width:26px!important;min-width:26px!important;border-right:1px solid #173d38!important;padding:0!important}
    [data-pf24-sweatbox-toolbar='true']>button svg{height:18px!important;width:21px!important}
    [data-pf24-sweatbox-toolbar='true']>div.absolute{top:21px!important}
    [data-pf24-sweatbox-instructor-editor='true']{pointer-events:auto!important;z-index:2147483000!important;isolation:isolate!important}
    [data-pf24-sweatbox-instructor-editor='true'] input,
    [data-pf24-sweatbox-instructor-editor='true'] textarea{pointer-events:auto!important;user-select:text!important;cursor:text!important;opacity:1!important}
    [data-pf24-sweatbox-instructor-editor='true'] button{pointer-events:auto!important}
  `}</style>;
}
