from flask import Flask
from flask_restful import Api, Resource, reqparse
from api.nodes import data 

app = Flask(__name__)
api = Api(app)

class Story(Resource):
    def get(self, id): 
        for node in data.nodes:
            if(id == node["id"]):
                return node, 200
    
        return "Node not found", 404
    def post(self, id): 
        parser = reqparse.RequestParser()
        parser.add_argument("dialogue")
        parser.add_argument("choiceA")
        parser.add_argument("choiceB")
        args = parser.parse_args()

        for node in data.nodes:
            if(id == node["id"]):
                return "Node with id {} already exists".format(id), 400

        node = {
            "id": id,
            "dialogue": args["dialogue"],
            "choiceA": args["choiceA"],
            "choiceB": args["choiceB"]
        }
        data.nodes.append(node)
        return node, 201

    def put(self, id):
        parser = reqparse.RequestParser()
        parser.add_argument("dialogue")
        parser.add_argument("choiceA")
        parser.add_argument("choiceB")
        args = parser.parse_args()

        for node in data.nodes:
            if(id == node["id"]):
                node["dialogue"] = args["dialogue"]
                node["choiceA"] = args["choiceA"]
                node["choiceB"] = args["choiceB"]
                return node, 200
        
        node = {
            "id": id,
            "dialogue": args["dialogue"],
            "choiceA": args["choiceA"],
            "choiceB": args["choiceB"]
        }
        data.nodes.append(node)
        return node, 201

    def delete(self, name):
        global ndoes
        nodes = [node for node in data.nodes if node["name"] != name]
        return "{} is deleted.".format(name), 200
      
api.add_resource(Story, "/node/<string:id>")