CSEvent = {
    push: function (e, m, ms, mi, mrs) {
        return $.post("/api?action=event&e=" + e, {
            m: m,
            ms: ms,
            mi: mi,
            mrs: mrs
        });
    }
};