from flask import Flask, request
from flask_restful import Api, Resource, reqparse
import json, ast

#This pretty much comes from https://codeburst.io/this-is-how-easy-it-is-to-create-a-rest-api-8a25122ab1f3

app = Flask(__name__, static_url_path='')
api = Api(app)

@app.route('/')
def root():
    return app.send_static_file('index.html')

#This opens the JSON file and stores the data into a Python dictionary
with open("api/nodes.json", 'r') as f:
        jdata = json.load(f)
        nodes = ast.literal_eval(json.dumps(jdata))

class Story(Resource):
    def get(self, id):
        nodeArr = nodes['nodes']

        for i in range(len(nodeArr)): #For every node, find the matching ID and return the node with this ID
            if(int(id) == nodeArr[i]["id"]):
                node = nodeArr[i]

                # is there code to execute?
                if 'code' in node:
                    # deserialize state
                    stateString = request.args.get('state')
                    state = json.loads(stateString)

                    print(state)

                    # run code
                    code = node['code']
                    nodeInfo = {
                        'id': id
                    }

                    exec(code, {
                        'state': state,
                        'info': nodeInfo
                    })

                    # return state and node

                    return {
                        'node': nodeInfo,
                        'state': state
                    }, 200
                else:
                    return {
                        'node': node
                    }, 200

        return "Node not found", 404
    def post(self, id):
        parser = reqparse.RequestParser()
        parser.add_argument("dialogue")
        parser.add_argument("choices")
        args = parser.parse_args()

        for i in range(len(nodes["nodes"])):
            if(int(id) == nodes["nodes"][i]["id"]):
                return "Node with id {} already exists".format(id), 400

        node = {
            "id": id,
            "dialogue": args["dialogue"],
            "choiceA": args["choiceA"],
            "choiceB": args["choiceB"]
        }
        nodes["nodes"].append(node)
        return node, 201

    def put(self, id):
        parser = reqparse.RequestParser()
        parser.add_argument("dialogue")
        parser.add_argument("choices")
        args = parser.parse_args()

        for node in nodes["nodes"]:
            if(int(id) == nodes["nodes"][node]["id"]):
                node["dialogue"] = args["dialogue"]
                node["choices"] = args["choices"]
                return node, 200

        node = {
            "id": id,
            "dialogue": args["dialogue"],
            "choices": args["choices"]
        }
        nodes["nodes"].append(node)
        return node, 201

    def delete(self, id):
        global n
        n = [node for node in nodes if nodes["nodes"][node]["id"] != id]
        return "{} is deleted.".format(id), 200

api.add_resource(Story, "/node/<string:id>")
