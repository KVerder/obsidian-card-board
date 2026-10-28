module PersonTests exposing (suite)

import DataviewTaskCompletion
import Expect
import Form.SafeDecoder as SafeDecoder
import Form.Settings
import GlobalSettings
import Helpers.DecodeHelpers as DecodeHelpers
import Parser
import Person
import Settings
import TagList
import TaskItem
import Test exposing (Test, describe, test)
import TsJson.Encode as TsEncode


suite : Test
suite =
    describe "assignment and person colours"
        [ test "assignment metadata accepts a full name and is hidden from the task title" <|
            \() ->
                Parser.run (TaskItem.parserWithYear (Just 2026) DataviewTaskCompletion.NoCompletion "Tasks.md" Nothing TagList.empty 0)
                    "- [ ] Work @assigned(Alex Smith) #status/todo due 31-12"
                    |> Result.map (\task -> ( TaskItem.title task, TaskItem.assignee task ))
                    |> Expect.equal (Ok ( "Work", Just "Alex Smith" ))
        , test "invalid empty assignment metadata stays ordinary text" <|
            \() ->
                Parser.run (TaskItem.parser DataviewTaskCompletion.NoCompletion "Tasks.md" Nothing TagList.empty 0)
                    "- [ ] Work @assigned()"
                    |> Result.map TaskItem.assignee
                    |> Expect.equal (Ok Nothing)
        , test "the same person uses the same colour key regardless of case" <|
            \() ->
                Person.colorKey " Alex " |> Expect.equal (Person.colorKey "alex")
        , test "foreground contrast follows the chosen content colour" <|
            \() ->
                ( Person.foreground "#000000", Person.foreground "#ffffff" )
                    |> Expect.equal ( "#ffffff", "#111111" )
        , test "person palettes survive settings serialization" <|
            \() ->
                let
                    global =
                        GlobalSettings.default

                    people =
                        [ { name = "Alex Smith", color = "#aabbcc" } ]
                in
                { global | people = people }
                    |> TsEncode.runExample GlobalSettings.encoder
                    |> .output
                    |> DecodeHelpers.runDecoder GlobalSettings.v_0_13_0_decoder
                    |> .decoded
                    |> Result.map .people
                    |> Expect.equal (Ok people)
        , test "opening and saving ordinary settings preserves person colours" <|
            \() ->
                let
                    settings =
                        Settings.default

                    global =
                        settings.globalSettings

                    people =
                        [ { name = "Alex", color = "#112233" } ]
                in
                { settings | globalSettings = { global | people = people } }
                    |> Form.Settings.init
                    |> SafeDecoder.run Form.Settings.safeDecoder
                    |> Result.map (.globalSettings >> .people)
                    |> Expect.equal (Ok people)
        ]
