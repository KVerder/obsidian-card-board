module PlainDueDateTests exposing (suite)

import DataviewTaskCompletion
import Date
import Expect
import GlobalSettings
import Parser
import PlainDueDate
import TagList
import TaskItem
import Test exposing (Test, describe, test)
import UpdatedTaskItem


suite : Test
suite =
    describe "plain-text deadlines"
        [ test "two-digit years mean 2000 through 2099" <|
            \() ->
                PlainDueDate.fromString 2026 "due 31-12-27"
                    |> Maybe.map Date.toIsoString
                    |> Expect.equal (Just "2027-12-31")
        , test "omitted years use the supplied local year, including past days" <|
            \() ->
                PlainDueDate.fromString 2026 "due 01-01"
                    |> Maybe.map Date.toIsoString
                    |> Expect.equal (Just "2026-01-01")
        , test "leap days are validated against the supplied year" <|
            \() ->
                ( PlainDueDate.fromString 2024 "due 29-02" |> Maybe.map Date.toIsoString
                , PlainDueDate.fromString 2026 "due 29-02"
                )
                    |> Expect.equal ( Just "2024-02-29", Nothing )
        , test "impossible dates and malformed widths are rejected" <|
            \() ->
                [ "due 31-04-26", "due 00-12", "due 10-13", "due 1-02", "due 01-2", "due 01-02-2026", "due 01-02-2x" ]
                    |> List.map (PlainDueDate.fromString 2026)
                    |> Expect.equal (List.repeat 7 Nothing)
        , test "ISO dates remain accepted in the editor" <|
            \() ->
                PlainDueDate.fromString 2026 "2027-12-31"
                    |> Maybe.map Date.toIsoString
                    |> Expect.equal (Just "2027-12-31")
        , test "deadline tokens are removed from the title and other tags survive" <|
            \() ->
                parse "- [ ] Work due 31-12 #client"
                    |> Result.map (\task -> ( TaskItem.title task, TaskItem.due task |> Maybe.map Date.toIsoString, TaskItem.originalLine task ))
                    |> Expect.equal (Ok ( "Work", Just "2026-12-31", "- [ ] Work due 31-12 #client" ))
        , test "an invalid date stays ordinary task text" <|
            \() ->
                parse "- [ ] Work due 31-02-26"
                    |> Result.map (\task -> ( TaskItem.title task, TaskItem.due task ))
                    |> Expect.equal (Ok ( "Work due 31-02-26", Nothing ))
        , test "subtasks receive the same year context" <|
            \() ->
                parse "- [ ] Parent\n  - [ ] Child due 01-02"
                    |> Result.map (TaskItem.descendantTasks >> List.map (TaskItem.due >> Maybe.map Date.toIsoString))
                    |> Expect.equal (Ok [ Just "2026-02-01" ])
        , test "clearing a deadline removes the plain text before a block ID" <|
            \() ->
                parse "- [ ] Work due 31-12-26 #client ^id"
                    |> Result.map (UpdatedTaskItem.init >> UpdatedTaskItem.updateDate settings Nothing >> UpdatedTaskItem.toString)
                    |> Expect.equal (Ok "- [ ] Work #client ^id")
        , test "editing a deadline replaces it with one canonical date" <|
            \() ->
                parse "- [ ] Work due 31-12 #client ^id"
                    |> Result.map (UpdatedTaskItem.init >> UpdatedTaskItem.updateDate settings (PlainDueDate.fromString 2026 "due 01-02-27") >> UpdatedTaskItem.toString)
                    |> Expect.equal (Ok "- [ ] Work #client @due(2027-02-01) ^id")
        ]


parse text =
    Parser.run (TaskItem.parserWithYear (Just 2026) DataviewTaskCompletion.NoCompletion "Tasks.md" Nothing TagList.empty 0) text


settings =
    { dataviewTaskCompletion = DataviewTaskCompletion.NoCompletion
    , format = GlobalSettings.ObsidianCardBoard
    , inLocalTime = True
    , showUtcOffset = False
    }
