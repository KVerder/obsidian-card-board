module Worker.Session exposing
    ( Session
    , addTaskList
    , dataviewTaskCompletion
    , default
    , finishAdding
    , fromFlags
    , isLoading
    , removeTaskItems
    , replaceTaskList
    , taskList
    )

import DataviewTaskCompletion exposing (DataviewTaskCompletion)
import State exposing (State)
import TaskItem
import TaskList exposing (TaskList)
import Worker.InteropDefinitions as InteropDefinitions



-- TYPES


type Session
    = Session Model


type alias Model =
    { dataviewTaskCompletion : DataviewTaskCompletion
    , pending : List TaskList
    , taskList : State TaskList
    }



-- CREATE


default : Session
default =
    Session
        { dataviewTaskCompletion = DataviewTaskCompletion.default
        , pending = []
        , taskList = State.Waiting
        }


fromFlags : InteropDefinitions.Flags -> Session
fromFlags flags =
    Session
        { dataviewTaskCompletion = flags.dataviewTaskCompletion
        , pending = []
        , taskList = State.Waiting
        }



-- INFO


dataviewTaskCompletion : Session -> DataviewTaskCompletion
dataviewTaskCompletion (Session model) =
    model.dataviewTaskCompletion


taskList : Session -> TaskList
taskList (Session model) =
    case model.taskList of
        State.Waiting ->
            TaskList.empty

        State.Loading currentList ->
            TaskList.concat (currentList :: List.reverse model.pending)

        State.Loaded currentList ->
            currentList



-- TASKLIST MANIPULATION


addTaskList : TaskList -> Session -> Session
addTaskList list ((Session model) as session) =
    case model.taskList of
        State.Waiting ->
            Session { model | taskList = State.Loading TaskList.empty, pending = [ list ] }

        State.Loading _ ->
            Session { model | pending = list :: model.pending }

        State.Loaded currentList ->
            updateTaskListState (State.Loaded (TaskList.append currentList list)) session


isLoading : Session -> Bool
isLoading (Session model) =
    case model.taskList of
        State.Loaded _ ->
            False

        _ ->
            True


finishAdding : Session -> Session
finishAdding ((Session config) as session) =
    case config.taskList of
        State.Waiting ->
            updateTaskListState (State.Loaded TaskList.empty) session

        State.Loading _ ->
            updateTaskListState (State.Loaded (taskList session)) session

        State.Loaded _ ->
            session


removeTaskItems : List String -> Session -> Session
removeTaskItems taskIds ((Session config) as session) =
    case config.taskList of
        State.Waiting ->
            session

        State.Loading _ ->
            updateTaskListState (State.Loading (TaskList.filter (\i -> not <| List.member (TaskItem.id i) taskIds) (taskList session))) session

        State.Loaded currentList ->
            updateTaskListState (State.Loaded (TaskList.filter (\i -> not <| List.member (TaskItem.id i) taskIds) currentList)) session


replaceTaskList : TaskList -> Session -> Session
replaceTaskList newList ((Session config) as session) =
    case config.taskList of
        State.Waiting ->
            session

        State.Loading _ ->
            updateTaskListState (State.Loading newList) session

        State.Loaded _ ->
            updateTaskListState (State.Loaded newList) session



-- PRIVATE


updateTaskListState : State TaskList -> Session -> Session
updateTaskListState taskListState (Session model) =
    Session { model | taskList = taskListState, pending = [] }
