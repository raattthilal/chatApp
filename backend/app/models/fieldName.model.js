module.exports = function FieldName(sequelize) {
    var Sequelize = sequelize.constructor;

    var ret =
      sequelize.define('fieldName', {
        name: {
          type: Sequelize.STRING
        },
        type: {
          type: Sequelize.STRING
        },
        status: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
        modified_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
  
      }, {
        tableName: 'field_name',
        timestamps: false
  
      });
  
    return ret;
  }
  