from app.api.links import extract_wikilinks


def test_extract_wikilinks_simple():
    md = "This links to [[Alpha]] and [[Beta Gamma]]."
    assert extract_wikilinks(md) == ["Alpha", "Beta Gamma"]


def test_extract_wikilinks_ignores_broken():
    md = "Mismatched [[link and normal text, and nested [[Inner]] ok] text [[Z]]"
    # Our simple regex matches well-formed [[...]] only
    assert extract_wikilinks(md)[-1] == "Z"

